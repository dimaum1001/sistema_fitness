"""
Rotas de planos (ficha) e sessões.

Neste sistema, a ficha é "prescrita" pelo professor e o histórico do aluno é baseado em execuções.
Para evitar perda de histórico e permitir auditoria do que já existiu na ficha, NÃO apagamos itens:
- "Excluir" plano/sessão/exercício = marcar como arquivado (soft delete) nas tabelas *_meta.
- "Editar" exercício de sessão = criar um novo item e arquivar o antigo, ligando via replaced_by_id.

Assim, a ficha ativa fica limpa (apenas itens ativos aparecem), mas o banco preserva tudo.
"""

from typing import List, Optional
from datetime import datetime
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    TrainingPlan,
    TrainingPlanMeta,
    TrainingSession,
    TrainingSessionMeta,
    TrainingSessionExercise,
    TrainingSessionExerciseMeta,
    User,
    UserType,
    Student,
    Exercise,
    ExerciseMeta,
)
from ..schemas import (
    TrainingPlanCreate,
    TrainingPlanOut,
    TrainingSessionCreate,
    TrainingSessionOut,
    TrainingSessionExerciseCreate,
    TrainingSessionExerciseOut,
    TrainingSessionExerciseUpdate,
    SessionWithExercises,
)
from ..core.security import get_current_user


router = APIRouter()




@router.post("/", response_model=TrainingPlanOut)
def create_plan(payload: TrainingPlanCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode criar planos")
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    if student.professor_id != current.id:
        raise HTTPException(status_code=403, detail="Aluno não pertence a este professor")
    plan = TrainingPlan(
        student_id=payload.student_id,
        name=payload.name,
        goal=payload.goal,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _ensure_professor_owns_plan(db: Session, plan_id: int, professor_id: int) -> TrainingPlan:
    plan = db.get(TrainingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano nao encontrado")
    student = db.get(Student, plan.student_id)
    if not student or student.professor_id != professor_id:
        raise HTTPException(status_code=403, detail="Plano nao pertence a este professor")
    return plan


def _archive_plan(db: Session, plan_id: int, now: datetime) -> None:
    # Em vez de apagar (o que quebraria historico e referencias), apenas arquivamos.
    # A ficha ativa e filtrada por *_meta.active == True (ou ausencia de meta = ainda ativo).
    plan_meta = db.get(TrainingPlanMeta, plan_id)
    if not plan_meta:
        plan_meta = TrainingPlanMeta(plan_id=plan_id, active=False, archived_at=now)
    else:
        plan_meta.active = False
        plan_meta.archived_at = now
    db.add(plan_meta)

    # Arquiva tambem todas as sessoes e exercicios daquela ficha.
    sessions = db.query(TrainingSession).filter_by(plan_id=plan_id).all()
    for sess in sessions:
        sess_meta = db.get(TrainingSessionMeta, sess.id)
        if not sess_meta:
            sess_meta = TrainingSessionMeta(session_id=sess.id, active=False, archived_at=now)
        else:
            sess_meta.active = False
            sess_meta.archived_at = now
        db.add(sess_meta)

        items = db.query(TrainingSessionExercise).filter_by(session_id=sess.id).all()
        for item in items:
            item_meta = db.get(TrainingSessionExerciseMeta, item.id)
            if not item_meta:
                item_meta = TrainingSessionExerciseMeta(session_exercise_id=item.id, active=False, archived_at=now)
            else:
                item_meta.active = False
                item_meta.archived_at = now
            db.add(item_meta)


@router.patch("/{plan_id}/desativar", status_code=204)
def deactivate_plan(plan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode desativar planos")
    _ensure_professor_owns_plan(db, plan_id, current.id)
    _archive_plan(db, plan_id, datetime.utcnow())
    db.commit()
    return JSONResponse(status_code=204, content=None)


@router.delete("/{plan_id}", status_code=204)
def delete_plan(plan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode excluir planos")
    _ensure_professor_owns_plan(db, plan_id, current.id)
    _archive_plan(db, plan_id, datetime.utcnow())
    db.commit()
    return JSONResponse(status_code=204, content=None)


def _list_student_plans(db: Session, student_id: int, include_inactive: bool = False) -> List[TrainingPlan]:
    query = (
        db.query(TrainingPlan, TrainingPlanMeta.active, TrainingPlanMeta.archived_at)
        .outerjoin(TrainingPlanMeta, TrainingPlanMeta.plan_id == TrainingPlan.id)
        .filter(TrainingPlan.student_id == student_id)
    )
    if not include_inactive:
        # Por padrao mantemos apenas os planos ativos da ficha atual.
        query = query.filter(or_(TrainingPlanMeta.active.is_(None), TrainingPlanMeta.active.is_(True)))
    rows = query.order_by(TrainingPlan.id.desc()).all()
    plans: List[TrainingPlan] = []
    for plan, active_flag, archived_at in rows:
        plan.active = True if active_flag is None else bool(active_flag)
        plan.archived_at = archived_at
        plans.append(plan)
    return plans


@router.get("/aluno/me/planos", response_model=List[TrainingPlanOut])
def list_my_plans(
    include_inactive: bool = True,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.ALUNO:
        raise HTTPException(status_code=403, detail="Apenas aluno pode listar os proprios planos")
    student = db.query(Student).filter_by(user_id=current.id).first()
    if not student:
        return []
    return _list_student_plans(db, student.id, include_inactive=include_inactive)


@router.get("/aluno/{student_id}/planos", response_model=List[TrainingPlanOut])
def list_plans(
    student_id: int,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    if current.type == UserType.PROFESSOR and student.professor_id != current.id:
        raise HTTPException(status_code=403, detail="Aluno nao pertence a este professor")
    if current.type == UserType.ALUNO and current.id != student.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado a planos de outro aluno")
    return _list_student_plans(db, student.id, include_inactive=include_inactive)


@router.post("/sessao", response_model=TrainingSessionOut)
def create_session(payload: TrainingSessionCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode criar sessões")
    plan = db.get(TrainingPlan, payload.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    # Não permite adicionar sessão em plano já arquivado.
    plan_meta = db.get(TrainingPlanMeta, plan.id)
    if plan_meta and plan_meta.active is False:
        raise HTTPException(status_code=404, detail="Plano arquivado")
    student = db.get(Student, plan.student_id)
    if not student or student.professor_id != current.id:
        raise HTTPException(status_code=403, detail="Plano não pertence a este professor")
    next_sequence = payload.sequence
    if next_sequence is None:
        max_sequence = (
            db.query(func.max(TrainingSession.sequence))
            .filter(TrainingSession.plan_id == payload.plan_id)
            .scalar()
        )
        next_sequence = (max_sequence or 0) + 1
    session = TrainingSession(
        plan_id=payload.plan_id,
        name=payload.name,
        sequence=next_sequence,
        main_type=payload.main_type,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessao/{plan_id}", response_model=List[TrainingSessionOut])
def list_sessions(plan_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    plan = db.get(TrainingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    student = db.get(Student, plan.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    if current.type == UserType.PROFESSOR:
        if student.professor_id != current.id:
            raise HTTPException(status_code=403, detail="Plano não pertence a este professor")
    elif current.type == UserType.ALUNO:
        if student.user_id != current.id:
            raise HTTPException(status_code=403, detail="Acesso negado a sessões de outro aluno")
    else:
        raise HTTPException(status_code=403, detail="Perfil não autorizado")
    # Lista somente sessões ativas do plano.
    return (
        db.query(TrainingSession)
        .outerjoin(TrainingSessionMeta, TrainingSessionMeta.session_id == TrainingSession.id)
        .filter(TrainingSession.plan_id == plan_id)
        .filter(or_(TrainingSessionMeta.active.is_(None), TrainingSessionMeta.active.is_(True)))
        .order_by(TrainingSession.sequence, TrainingSession.id)
        .all()
    )


# Helpers
def _ensure_professor_owns_session(db: Session, session_id: int, professor_id: int) -> TrainingSession:
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    # Sessões arquivadas não devem ser manipuladas pela ficha ativa.
    meta = db.get(TrainingSessionMeta, session_id)
    if meta and meta.active is False:
        raise HTTPException(status_code=404, detail="Sessão arquivada")
    plan = db.get(TrainingPlan, session.plan_id)
    student = db.get(Student, plan.student_id) if plan else None
    if not plan or not student or student.professor_id != professor_id:
        raise HTTPException(status_code=403, detail="Sessão não pertence a este professor")
    return session


def _parse_params(value):
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return None
    return value

def _next_exercise_order(db: Session, session_id: int) -> int:
    # Próxima posição na ordem (considerando apenas itens ativos).
    max_order = (
        db.query(func.max(TrainingSessionExercise.order))
        .outerjoin(
            TrainingSessionExerciseMeta,
            TrainingSessionExerciseMeta.session_exercise_id == TrainingSessionExercise.id,
        )
        .filter(TrainingSessionExercise.session_id == session_id)
        .filter(or_(TrainingSessionExerciseMeta.active.is_(None), TrainingSessionExerciseMeta.active.is_(True)))
        .scalar()
    )
    return (max_order or 0) + 1


@router.get("/sessao/{session_id}/exercicios", response_model=List[TrainingSessionExerciseOut])
def list_session_exercises(session_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode listar exercícios da sessão")
    _ensure_professor_owns_session(db, session_id, current.id)
    # Lista somente exercícios ativos da sessão.
    items = (
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
    for item in items:
        item.params = _parse_params(item.params)
    return items


@router.post("/sessao/{session_id}/exercicios", response_model=TrainingSessionExerciseOut)
def add_session_exercise(
    session_id: int,
    payload: TrainingSessionExerciseCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode adicionar exercícios à sessão")
    session = _ensure_professor_owns_session(db, session_id, current.id)

    exercise = db.get(Exercise, payload.exercise_id)
    if not exercise or (exercise.professor_id not in (None, current.id)):
        raise HTTPException(status_code=404, detail="Exercício não encontrado ou não pertence a você")

    meta = db.get(ExerciseMeta, exercise.id)
    if meta and meta.active is False:
        raise HTTPException(status_code=404, detail="Exercicio arquivado")
    next_order = payload.order if payload.order and payload.order > 0 else _next_exercise_order(db, session.id)
    sess_ex = TrainingSessionExercise(
        session_id=session.id,
        exercise_id=payload.exercise_id,
        order=next_order,
        params=payload.params,
        notes=payload.notes,
    )
    db.add(sess_ex)
    db.commit()
    db.refresh(sess_ex)
    sess_ex.params = _parse_params(sess_ex.params)
    return sess_ex


@router.post("/sessao/{session_id}/exercicios/lote", response_model=List[TrainingSessionExerciseOut])
def add_session_exercises_bulk(
    session_id: int,
    payload: List[TrainingSessionExerciseCreate],
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode adicionar exercÇðcios Çÿ sessÇœo")
    session = _ensure_professor_owns_session(db, session_id, current.id)
    if not payload:
        return []

    next_order = _next_exercise_order(db, session.id)
    created: List[TrainingSessionExercise] = []

    for item in payload:
        exercise = db.get(Exercise, item.exercise_id)
        if not exercise or (exercise.professor_id not in (None, current.id)):
            raise HTTPException(
                status_code=404,
                detail=f"ExercÇðcio {item.exercise_id} nÇœo encontrado ou nÇœo pertence a vocÇ¦",
            )

        meta = db.get(ExerciseMeta, exercise.id)
        if meta and meta.active is False:
            raise HTTPException(status_code=404, detail="Exercicio arquivado")
        order_value = item.order if item.order and item.order > 0 else next_order
        next_order = max(next_order, order_value + 1)

        sess_ex = TrainingSessionExercise(
            session_id=session.id,
            exercise_id=item.exercise_id,
            order=order_value,
            params=item.params,
            notes=item.notes,
        )
        db.add(sess_ex)
        created.append(sess_ex)

    db.commit()
    for obj in created:
        db.refresh(obj)
        obj.params = _parse_params(obj.params)
    return created


@router.patch("/sessao/exercicios/{item_id}", response_model=TrainingSessionExerciseOut)
def update_session_exercise(
    item_id: int,
    payload: TrainingSessionExerciseUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    sess_ex = db.get(TrainingSessionExercise, item_id)
    if not sess_ex:
        raise HTTPException(status_code=404, detail="Exercício de sessão não encontrado")

    # Importante: aluno não edita ficha (ele registra execução/carga no histórico).
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode editar exercício da sessão")

    _ensure_professor_owns_session(db, sess_ex.session_id, current.id)
    existing_meta = db.get(TrainingSessionExerciseMeta, sess_ex.id)
    if existing_meta and existing_meta.active is False:
        raise HTTPException(status_code=404, detail="Exercício de sessão arquivado")

    # Versionamento: cria um novo item com os novos dados e arquiva o anterior.
    # Isso evita que alterações do professor "reescrevam" o que o aluno fez no passado.
    new_item = TrainingSessionExercise(
        session_id=sess_ex.session_id,
        exercise_id=sess_ex.exercise_id,
        order=payload.order if payload.order is not None else sess_ex.order,
        params=payload.params if payload.params is not None else sess_ex.params,
        notes=payload.notes if payload.notes is not None else sess_ex.notes,
    )
    db.add(new_item)
    db.flush()

    now = datetime.utcnow()
    meta = existing_meta or TrainingSessionExerciseMeta(session_exercise_id=sess_ex.id)
    meta.active = False
    meta.archived_at = now
    meta.replaced_by_id = new_item.id
    db.add(meta)

    db.commit()
    db.refresh(new_item)
    new_item.params = _parse_params(new_item.params)
    return new_item


@router.delete("/sessao/exercicios/{item_id}", status_code=204)
def delete_session_exercise(
    item_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    sess_ex = db.get(TrainingSessionExercise, item_id)
    if not sess_ex:
        raise HTTPException(status_code=404, detail="Exercício de sessão não encontrado")

    # Excluir item = arquivar (soft delete). Mantém histórico/execuções intactas.
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode excluir exercício da sessão")
    _ensure_professor_owns_session(db, sess_ex.session_id, current.id)

    now = datetime.utcnow()
    meta = db.get(TrainingSessionExerciseMeta, sess_ex.id)
    if not meta:
        meta = TrainingSessionExerciseMeta(session_exercise_id=sess_ex.id, active=False, archived_at=now)
    else:
        meta.active = False
        meta.archived_at = now
    db.add(meta)
    db.commit()
    return JSONResponse(status_code=204, content=None)


@router.delete("/sessao/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode excluir sessão")
    session = db.get(TrainingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    plan = db.get(TrainingPlan, session.plan_id)
    student = db.get(Student, plan.student_id) if plan else None
    if not plan or not student or student.professor_id != current.id:
        raise HTTPException(status_code=403, detail="Sessão não pertence a este professor")

    # Excluir sessão = arquivar (soft delete). Mantém execuções e referências.
    now = datetime.utcnow()
    sess_meta = db.get(TrainingSessionMeta, session_id)
    if not sess_meta:
        sess_meta = TrainingSessionMeta(session_id=session_id, active=False, archived_at=now)
    else:
        sess_meta.active = False
        sess_meta.archived_at = now
    db.add(sess_meta)

    items = db.query(TrainingSessionExercise).filter_by(session_id=session_id).all()
    for item in items:
        item_meta = db.get(TrainingSessionExerciseMeta, item.id)
        if not item_meta:
            item_meta = TrainingSessionExerciseMeta(session_exercise_id=item.id, active=False, archived_at=now)
        else:
            item_meta.active = False
            item_meta.archived_at = now
        db.add(item_meta)
    db.commit()
    return JSONResponse(status_code=204, content=None)


@router.post("/sessao/{session_id}/exercicios/copiar", response_model=List[TrainingSessionExerciseOut])
def copy_session_exercises(
    session_id: int,
    source_session_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode copiar exercícios")
    target_session = _ensure_professor_owns_session(db, session_id, current.id)
    _ensure_professor_owns_session(db, source_session_id, current.id)

    # Copia apenas itens ativos da sessão de origem.
    source_items = (
        db.query(TrainingSessionExercise)
        .outerjoin(
            TrainingSessionExerciseMeta,
            TrainingSessionExerciseMeta.session_exercise_id == TrainingSessionExercise.id,
        )
        .filter(TrainingSessionExercise.session_id == source_session_id)
        .filter(or_(TrainingSessionExerciseMeta.active.is_(None), TrainingSessionExerciseMeta.active.is_(True)))
        .order_by(TrainingSessionExercise.order, TrainingSessionExercise.id)
        .all()
    )
    cloned = []
    for item in source_items:
        cloned_item = TrainingSessionExercise(
            session_id=target_session.id,
            exercise_id=item.exercise_id,
            order=item.order,
            params=item.params,
            notes=item.notes,
        )
        db.add(cloned_item)
        cloned.append(cloned_item)
    db.commit()
    for item in cloned:
        db.refresh(item)
        item.params = _parse_params(item.params)
    return cloned


@router.get("/aluno/agenda", response_model=List[SessionWithExercises])
def student_agenda(
    session_number: Optional[int] = None,
    plan_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.ALUNO:
        raise HTTPException(status_code=403, detail="Apenas aluno pode ver a própria agenda")

    student = db.query(Student).filter_by(user_id=current.id).first()
    if not student:
        return []

    # Aluno só enxerga planos/sessões ativos na agenda.
    plans_q = (
        db.query(TrainingPlan)
        .outerjoin(TrainingPlanMeta, TrainingPlanMeta.plan_id == TrainingPlan.id)
        .filter(TrainingPlan.student_id == student.id)
        .filter(or_(TrainingPlanMeta.active.is_(None), TrainingPlanMeta.active.is_(True)))
    )
    if plan_id:
        try:
            plan_int = int(plan_id)
        except ValueError:
            plan_int = None
        if plan_int:
            plans_q = plans_q.filter(TrainingPlan.id == plan_int)
    plan_ids = [p.id for p in plans_q.all()]
    if not plan_ids:
        return []

    sessions_q = (
        db.query(TrainingSession)
        .outerjoin(TrainingSessionMeta, TrainingSessionMeta.session_id == TrainingSession.id)
        .filter(TrainingSession.plan_id.in_(plan_ids))
        .filter(or_(TrainingSessionMeta.active.is_(None), TrainingSessionMeta.active.is_(True)))
    )
    if session_number is not None:
        sessions_q = sessions_q.filter(TrainingSession.sequence == session_number)
    sessions = sessions_q.order_by(TrainingSession.sequence, TrainingSession.id).all()

    result: List[SessionWithExercises] = []
    for sess in sessions:
        # Exercícios ativos da sessão.
        exercises = (
            db.query(TrainingSessionExercise)
            .outerjoin(
                TrainingSessionExerciseMeta,
                TrainingSessionExerciseMeta.session_exercise_id == TrainingSessionExercise.id,
            )
            .filter(TrainingSessionExercise.session_id == sess.id)
            .filter(or_(TrainingSessionExerciseMeta.active.is_(None), TrainingSessionExerciseMeta.active.is_(True)))
            .order_by(TrainingSessionExercise.order, TrainingSessionExercise.id)
            .all()
        )
        payload = SessionWithExercises(
            id=sess.id,
            plan_id=sess.plan_id,
            student_id=student.id,
            name=sess.name,
            sequence=sess.sequence,
            main_type=sess.main_type,
            notes=sess.notes,
            exercises=[],
        )
        for ex in exercises:
            ex_obj = ex.exercise
            exercise_payload = {
                "id": ex_obj.id,
                "name": ex_obj.name,
                "type": ex_obj.type,
                "group": ex_obj.group,
                "description": ex_obj.description,
                "tips": ex_obj.tips,
                "video_url": ex_obj.video_url,
                "endurance_params": _parse_params(ex_obj.endurance_params),
            }
            payload.exercises.append(
                {
                    "id": ex.id,
                    "order": ex.order,
                    "params": _parse_params(ex.params),
                    "notes": ex.notes,
                    "exercise": exercise_payload,
                }
            )
        result.append(payload)
    return result
