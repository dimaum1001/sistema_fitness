"""
Rotas de execuções (histórico).

Objetivo principal:
- Registrar o que o aluno fez em cada sessão (TrainingExecution) e em cada exercício (ExerciseExecution),
  salvando um snapshot da ficha naquele dia + os dados realizados (carga/reps), para comparar evolução.

Por design, o aluno não "edita a ficha". Ele registra a execução. Assim:
- Mudanças do professor na ficha NÃO alteram o histórico já registrado.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Exercise,
    ExerciseExecution,
    Student,
    TrainingExecution,
    TrainingPlan,
    TrainingSession,
    TrainingSessionExercise,
    TrainingSessionExerciseMeta,
    User,
    UserType,
)
from ..schemas import (
    ExecutionExerciseBrief,
    ExerciseExecutionIn,
    ExerciseEvolutionItem,
    LastExercisePerformanceItem,
    TrainingExecutionCreate,
    TrainingExecutionReport,
)
from ..core.security import get_current_user

router = APIRouter()


def _get_session_plan_student(db: Session, session_id: int):
    # Resolve sessão -> plano -> aluno dono do plano.
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    plan = db.get(TrainingPlan, session.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    student = db.get(Student, plan.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return session, plan, student


def _ensure_access_student(db: Session, current: User, student_id: int) -> Student:
    # Professor: pode ver apenas seus alunos. Aluno: pode ver apenas a si mesmo.
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    if current.type == UserType.PROFESSOR:
        if student.professor_id != current.id:
            raise HTTPException(status_code=403, detail="Aluno não pertence a este professor")
    elif current.type == UserType.ALUNO:
        if student.user_id != current.id:
            raise HTTPException(status_code=403, detail="Acesso negado a execuções de outro aluno")
    else:
        raise HTTPException(status_code=403, detail="Perfil não autorizado")
    return student


def _get_current_student(db: Session, current: User) -> Student:
    # Conveniência para rotas "minhas" (não dependem de student_id).
    if current.type != UserType.ALUNO:
        raise HTTPException(status_code=403, detail="Apenas aluno pode acessar este recurso")
    student = db.query(Student).filter_by(user_id=current.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return student


def _parse_load_value(value: Any) -> Optional[float]:
    # Extrai valor numérico de cargas como "20", "20kg", "20,5" etc.
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip()
    if not raw:
        return None
    # aceita "20", "20kg", "20,5", "20.5"
    import re

    match = re.search(r"(-?\\d+(?:[\\.,]\\d+)?)", raw)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def _parse_reps_value(value: Any) -> Optional[float]:
    # Extrai valor numérico de reps como "12", "12-10-8" (pega o primeiro número), etc.
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip()
    if not raw:
        return None
    import re

    match = re.search(r"(-?\\d+(?:[\\.,]\\d+)?)", raw)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def _extract_max_load_and_reps(performed: Optional[Dict[str, Any]]):
    # Para evolução, pegamos um resumo simples por execução:
    # - maior carga registrada naquela sessão (máximo dentro de set_details)
    # - maior número de reps registrado naquela sessão (máximo dentro de set_details)
    performed = performed or {}

    max_load_value: Optional[float] = None
    max_load_raw: Optional[str] = None
    max_reps_value: Optional[float] = None
    max_reps_raw: Optional[str] = None

    set_details = performed.get("set_details")
    if isinstance(set_details, list):
        for row in set_details:
            if not isinstance(row, dict):
                continue

            raw_load = row.get("load")
            load_value = _parse_load_value(raw_load)
            if load_value is not None and (max_load_value is None or load_value > max_load_value):
                max_load_value = load_value
                max_load_raw = None if raw_load is None else str(raw_load)

            raw_reps = row.get("reps")
            reps_value = _parse_reps_value(raw_reps)
            if reps_value is not None and (max_reps_value is None or reps_value > max_reps_value):
                max_reps_value = reps_value
                max_reps_raw = None if raw_reps is None else str(raw_reps)
    else:
        raw_load = performed.get("load")
        load_value = _parse_load_value(raw_load)
        if load_value is not None:
            max_load_value = load_value
            max_load_raw = None if raw_load is None else str(raw_load)

        raw_reps = performed.get("reps")
        reps_value = _parse_reps_value(raw_reps)
        if reps_value is not None:
            max_reps_value = reps_value
            max_reps_raw = None if raw_reps is None else str(raw_reps)

    return max_load_value, max_load_raw, max_reps_value, max_reps_raw


def _compute_student_evolution(db: Session, student_id: int) -> List[ExerciseEvolutionItem]:
    # Calcula evolução agregada por exercício:
    # - Último e melhor registro de carga/reps (máximo por execução)
    # - Delta (último - anterior), quando houver histórico suficiente
    rows = (
        db.query(ExerciseExecution, TrainingExecution.id, TrainingExecution.executed_at, Exercise)
        .join(TrainingExecution, TrainingExecution.id == ExerciseExecution.training_execution_id)
        .join(TrainingSessionExercise, TrainingSessionExercise.id == ExerciseExecution.session_exercise_id)
        .join(Exercise, Exercise.id == TrainingSessionExercise.exercise_id)
        .filter(TrainingExecution.student_id == student_id)
        .order_by(TrainingExecution.executed_at.asc(), TrainingExecution.id.asc(), ExerciseExecution.id.asc())
        .all()
    )

    # Agrega por (exercício, execução) para não duplicar caso o mesmo exercício apareça mais de uma vez na sessão.
    measurements: Dict[Tuple[int, int], Dict[str, Any]] = {}
    exercise_info: Dict[int, Dict[str, Any]] = {}

    for ex_exec, exec_id, executed_at, exercise in rows:
        if not exercise:
            continue
        exercise_info.setdefault(
            exercise.id,
            {"name": exercise.name, "type": exercise.type, "group": exercise.group},
        )
        _, performed = _parse_execution_item(ex_exec.data)
        max_load_value, max_load_raw, max_reps_value, max_reps_raw = _extract_max_load_and_reps(performed)

        key = (exercise.id, exec_id)
        current = measurements.get(key)
        if not current:
            measurements[key] = {
                "exec_id": exec_id,
                "executed_at": executed_at,
                "max_load_value": max_load_value,
                "max_load_raw": max_load_raw,
                "max_reps_value": max_reps_value,
                "max_reps_raw": max_reps_raw,
            }
            continue

        if max_load_value is not None and (current["max_load_value"] is None or max_load_value > current["max_load_value"]):
            current["max_load_value"] = max_load_value
            current["max_load_raw"] = max_load_raw
        if max_reps_value is not None and (current["max_reps_value"] is None or max_reps_value > current["max_reps_value"]):
            current["max_reps_value"] = max_reps_value
            current["max_reps_raw"] = max_reps_raw

    per_exercise: Dict[int, List[Dict[str, Any]]] = {}
    for (exercise_id, _), item in measurements.items():
        per_exercise.setdefault(exercise_id, []).append(item)

    result: List[ExerciseEvolutionItem] = []
    for exercise_id, items in per_exercise.items():
        info = exercise_info.get(exercise_id) or {"name": "Exercício", "type": None, "group": None}
        items.sort(key=lambda x: (x.get("executed_at") or datetime.min, x.get("exec_id") or 0))

        last = items[-1] if items else None
        prev = items[-2] if len(items) >= 2 else None

        best_load_item = None
        best_reps_item = None
        for it in items:
            if it.get("max_load_value") is not None and (
                best_load_item is None or it["max_load_value"] > best_load_item["max_load_value"]
            ):
                best_load_item = it
            if it.get("max_reps_value") is not None and (
                best_reps_item is None or it["max_reps_value"] > best_reps_item["max_reps_value"]
            ):
                best_reps_item = it

        if best_load_item is None and best_reps_item is None:
            # Sem dados numéricos de carga/reps registrados para este exercício.
            continue

        last_load_value = last.get("max_load_value") if last else None
        prev_load_value = prev.get("max_load_value") if prev else None
        delta_load_value = (
            (last_load_value - prev_load_value)
            if last_load_value is not None and prev_load_value is not None
            else None
        )

        last_reps_value = last.get("max_reps_value") if last else None
        prev_reps_value = prev.get("max_reps_value") if prev else None
        delta_reps_value = (
            (last_reps_value - prev_reps_value)
            if last_reps_value is not None and prev_reps_value is not None
            else None
        )

        result.append(
            ExerciseEvolutionItem(
                exercise_id=exercise_id,
                name=info["name"],
                type=info["type"],
                group=info["group"],
                last_executed_at=last.get("executed_at") if last else None,
                last_load=last.get("max_load_raw") if last else None,
                last_load_value=last_load_value,
                best_load=best_load_item.get("max_load_raw") if best_load_item else None,
                best_load_value=best_load_item.get("max_load_value") if best_load_item else None,
                prev_load=prev.get("max_load_raw") if prev else None,
                prev_load_value=prev_load_value,
                delta_load_value=delta_load_value,
                last_reps=last.get("max_reps_raw") if last else None,
                last_reps_value=last_reps_value,
                best_reps=best_reps_item.get("max_reps_raw") if best_reps_item else None,
                best_reps_value=best_reps_item.get("max_reps_value") if best_reps_item else None,
                prev_reps=prev.get("max_reps_raw") if prev else None,
                prev_reps_value=prev_reps_value,
                delta_reps_value=delta_reps_value,
                total_executions=len(items),
            )
        )

    # Mais recente primeiro
    result.sort(key=lambda x: (x.last_executed_at or datetime.min), reverse=True)
    return result


def _execution_to_payload(db: Session, execu: TrainingExecution) -> TrainingExecutionReport:
    # Converte uma execução do banco para o formato usado na UI.
    # Preferimos os itens de ExerciseExecution (snapshot + performed). Se não existirem (execuções antigas),
    # fazemos fallback para os itens atuais da sessão (sem performed).
    session = execu.session or db.get(TrainingSession, execu.session_id)
    plan = db.get(TrainingPlan, session.plan_id) if session else None
    exercises: List[ExecutionExerciseBrief] = []

    exec_items = (
        db.query(ExerciseExecution)
        .filter(ExerciseExecution.training_execution_id == execu.id)
        .order_by(ExerciseExecution.id)
        .all()
    )

    if exec_items:
        for item in exec_items:
            snapshot, performed = _parse_execution_item(item.data)
            sess_ex = item.session_exercise or db.get(TrainingSessionExercise, item.session_exercise_id)
            ex_obj = sess_ex.exercise if sess_ex else None

            order_value = (
                (snapshot or {}).get("order")
                or (sess_ex.order if sess_ex else None)
                or 0
            )
            name_value = (
                (snapshot or {}).get("exercise_name")
                or (ex_obj.name if ex_obj else "Exercício")
            )
            type_value = (
                (snapshot or {}).get("exercise_type")
                or (ex_obj.type if ex_obj else None)
            )

            exercises.append(
                ExecutionExerciseBrief(
                    id=item.session_exercise_id,
                    order=order_value,
                    name=name_value,
                    type=type_value,
                    exercise_id=(snapshot or {}).get("exercise_id") or (ex_obj.id if ex_obj else None),
                    group=(snapshot or {}).get("exercise_group") or (ex_obj.group if ex_obj else None),
                    prescribed_params=(snapshot or {}).get("prescribed_params"),
                    performed=performed,
                    notes=item.notes,
                )
            )
    elif session and session.items:
        # fallback para execuções antigas que ainda não tinham detalhamento por exercício
        for item in session.items:
            if not item.exercise:
                continue
            exercises.append(
                ExecutionExerciseBrief(
                    id=item.id,
                    order=item.order,
                    name=item.exercise.name,
                    type=item.exercise.type,
                    exercise_id=item.exercise_id,
                    group=item.exercise.group,
                    prescribed_params=_parse_params(item.params),
                )
            )
    return TrainingExecutionReport(
        id=execu.id,
        student_id=execu.student_id,
        session_id=execu.session_id,
        session_name=session.name if session else None,
        plan_name=plan.name if plan else None,
        executed_at=execu.executed_at,
        status=execu.status,
        rpe=execu.rpe,
        comment=execu.comment,
        exercises=exercises,
    )


def _parse_params(value: Any) -> Optional[Dict[str, Any]]:
    # Converte JSON guardado como string (ou dict) para dict Python.
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return None
    if isinstance(value, dict):
        return value
    return None


def _parse_execution_item(raw: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    # Decodifica o JSON armazenado em ExerciseExecution.data.
    if not raw:
        return None, None
    try:
        payload = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return None, None
    if not isinstance(payload, dict):
        return None, None
    snapshot = payload.get("snapshot") if isinstance(payload.get("snapshot"), dict) else None
    performed = payload.get("performed") if isinstance(payload.get("performed"), dict) else None
    return snapshot, performed


def _list_active_session_exercises(db: Session, session_id: int) -> List[TrainingSessionExercise]:
    # Lista apenas itens ativos da ficha (exercícios da sessão) para snapshot/execução.
    return (
        db.query(TrainingSessionExercise)
        .outerjoin(
            TrainingSessionExerciseMeta,
            TrainingSessionExerciseMeta.session_exercise_id == TrainingSessionExercise.id,
        )
        .filter(TrainingSessionExercise.session_id == session_id)
        .filter(or_(TrainingSessionExerciseMeta.active.is_(None), TrainingSessionExerciseMeta.active.is_(True)))
        .order_by(TrainingSessionExercise.order, TrainingSessionExercise.id)
        .all()
    )


@router.post("/", response_model=TrainingExecutionReport)
def create_execution(payload: TrainingExecutionCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # Cria uma execução e grava um snapshot de cada exercício da sessão + o que foi realizado (performed).
    session, _, session_student = _get_session_plan_student(db, payload.session_id)

    if current.type == UserType.ALUNO:
        student = db.query(Student).filter_by(user_id=current.id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Aluno não encontrado")
        if payload.student_id != student.id:
            raise HTTPException(status_code=403, detail="Acesso negado a execuções de outro aluno")
        if session_student.id != student.id:
            raise HTTPException(status_code=403, detail="Sessão não pertence ao seu plano")
        student_id = student.id
    elif current.type == UserType.PROFESSOR:
        # Professor pode registrar manualmente, mas apenas para seus alunos.
        student = db.get(Student, payload.student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Aluno não encontrado")
        if student.professor_id != current.id:
            raise HTTPException(status_code=403, detail="Aluno não pertence a este professor")
        if session_student.id != student.id:
            raise HTTPException(status_code=403, detail="Sessão não pertence ao aluno informado")
        student_id = student.id
    else:
        raise HTTPException(status_code=403, detail="Perfil não autorizado")

    # Registro principal da execução da sessão (data, status, rpe etc.).
    execu = TrainingExecution(
        student_id=student_id,
        session_id=session.id,
        status=payload.status,
        rpe=payload.rpe,
        comment=payload.comment,
    )
    db.add(execu)
    db.flush()

    active_items = _list_active_session_exercises(db, session.id)
    provided: List[ExerciseExecutionIn] = payload.exercises or []
    performed_by_id: Dict[int, ExerciseExecutionIn] = {p.session_exercise_id: p for p in provided}

    if provided:
        # Valida que o client só está mandando exercícios que pertencem a esta sessão e estão ativos.
        active_ids = {i.id for i in active_items}
        invalid = [sess_ex_id for sess_ex_id in performed_by_id.keys() if sess_ex_id not in active_ids]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"Exercícios inválidos para esta sessão: {', '.join(map(str, invalid))}",
            )

    # Para cada exercício da sessão, salvamos:
    # - snapshot (prescrição do professor naquele momento)
    # - performed (cargas/reps digitadas pelo aluno)
    for item in active_items:
        ex_obj = item.exercise or db.get(Exercise, item.exercise_id)
        perf = performed_by_id.get(item.id)
        performed_payload = perf.performed if perf else None
        notes = perf.notes if perf else None

        snapshot = {
            "session_exercise_id": item.id,
            "order": item.order,
            "exercise_id": item.exercise_id,
            "exercise_name": ex_obj.name if ex_obj else None,
            "exercise_type": ex_obj.type if ex_obj else None,
            "exercise_group": ex_obj.group if ex_obj else None,
            "prescribed_params": _parse_params(item.params),
            "session_exercise_notes": item.notes,
        }
        data = json.dumps({"snapshot": snapshot, "performed": performed_payload}, ensure_ascii=False)
        db.add(
            ExerciseExecution(
                training_execution_id=execu.id,
                session_exercise_id=item.id,
                data=data,
                notes=notes,
            )
        )

    db.commit()
    db.refresh(execu)
    return _execution_to_payload(db, execu)


@router.get("/aluno/{student_id}", response_model=List[TrainingExecutionReport])
def list_executions(student_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # Histórico por aluno (professor ou o próprio aluno).
    _ensure_access_student(db, current, student_id)
    q = db.query(TrainingExecution).filter_by(student_id=student_id)
    execs = q.order_by(TrainingExecution.executed_at.desc()).all()
    # Tocar relacionamentos para evitar lazy na serialização
    for e in execs:
        _ = e.session
        if e.session:
            _ = e.session.items
    return [_execution_to_payload(db, e) for e in execs]


@router.get("/aluno/{student_id}/evolucao", response_model=List[ExerciseEvolutionItem])
def student_evolution(student_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # Evolução por aluno (professor ou o próprio aluno).
    _ensure_access_student(db, current, student_id)
    return _compute_student_evolution(db, student_id)


@router.get("/minhas", response_model=List[TrainingExecutionReport])
def list_my_executions(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # Histórico do aluno logado.
    student = _get_current_student(db, current)
    q = db.query(TrainingExecution).filter_by(student_id=student.id)
    execs = q.order_by(TrainingExecution.executed_at.desc()).all()
    for e in execs:
        _ = e.session
        if e.session:
            _ = e.session.items
    return [_execution_to_payload(db, e) for e in execs]


@router.get("/minhas/evolucao", response_model=List[ExerciseEvolutionItem])
def my_evolution(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # Evolução do aluno logado.
    student = _get_current_student(db, current)
    return _compute_student_evolution(db, student.id)


@router.get("/minhas/ultimos_exercicios", response_model=List[LastExercisePerformanceItem])
def my_last_exercises(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # Retorna o último desempenho registrado por exercício (para pré-preencher carga/reps na UI).
    student = _get_current_student(db, current)
    rows = (
        db.query(ExerciseExecution, TrainingExecution.executed_at, Exercise)
        .join(TrainingExecution, TrainingExecution.id == ExerciseExecution.training_execution_id)
        .join(TrainingSessionExercise, TrainingSessionExercise.id == ExerciseExecution.session_exercise_id)
        .join(Exercise, Exercise.id == TrainingSessionExercise.exercise_id)
        .filter(TrainingExecution.student_id == student.id)
        .order_by(TrainingExecution.executed_at.desc(), TrainingExecution.id.desc(), ExerciseExecution.id.desc())
        .all()
    )

    seen: set[int] = set()
    result: List[LastExercisePerformanceItem] = []
    for ex_exec, executed_at, exercise in rows:
        if not exercise or exercise.id in seen:
            continue
        _, performed = _parse_execution_item(ex_exec.data)
        if not performed or not isinstance(performed, dict):
            continue
        if not any(key in performed for key in ("set_details", "load", "reps")):
            continue
        result.append(
            LastExercisePerformanceItem(
                exercise_id=exercise.id,
                name=exercise.name,
                type=exercise.type,
                group=exercise.group,
                executed_at=executed_at,
                performed=performed,
            )
        )
        seen.add(exercise.id)
    return result
