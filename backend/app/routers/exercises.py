from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Exercise, ExerciseMeta, Student, User, UserType
from ..schemas import ExerciseCreate, ExerciseOut, ExerciseUpdate
from ..core.security import get_current_user

router = APIRouter()


def _get_student(db: Session, user: User) -> Optional[Student]:
  return db.query(Student).filter_by(user_id=user.id).first()

def _attach_active(rows):
  result = []
  for ex, active in rows:
    ex.active = True if active is None else active
    result.append(ex)
  return result


@router.get("/", response_model=List[ExerciseOut])
def list_exercises(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
  # Professor vê só dele (e globais se professor_id nulo); aluno vê exercícios do professor vinculado (simples).
  if current.type == UserType.PROFESSOR:
    rows = (
      db.query(Exercise, ExerciseMeta.active)
      .outerjoin(ExerciseMeta, ExerciseMeta.exercise_id == Exercise.id)
      .filter((Exercise.professor_id == current.id) | (Exercise.professor_id.is_(None)))
      .all()
    )
  else:
    student = _get_student(db, current)
    if not student:
      return []
    rows = (
      db.query(Exercise, ExerciseMeta.active)
      .outerjoin(ExerciseMeta, ExerciseMeta.exercise_id == Exercise.id)
      .filter((Exercise.professor_id == student.professor_id) | (Exercise.professor_id.is_(None)))
      .filter(or_(ExerciseMeta.active.is_(None), ExerciseMeta.active.is_(True)))
      .all()
    )
  return _attach_active(rows)


@router.post("/", response_model=ExerciseOut)
def create_exercise(payload: ExerciseCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
  if current.type != UserType.PROFESSOR:
    raise HTTPException(status_code=403, detail="Apenas professor pode cadastrar exercícios")
  ex = Exercise(
    professor_id=current.id,
    name=payload.name,
    type=payload.type,
    group=payload.group,
    description=payload.description,
    tips=payload.tips,
    video_url=payload.video_url,
    endurance_params=payload.endurance_params,
  )
  db.add(ex)
  db.commit()
  db.refresh(ex)
  ex.active = True
  return ex


@router.get("/{exercise_id}/explicacao", response_model=ExerciseOut)
def explain_exercise(exercise_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
  ex = db.get(Exercise, exercise_id)
  if not ex:
    raise HTTPException(status_code=404, detail="Exercicio nao encontrado")
  meta = db.get(ExerciseMeta, exercise_id)
  if meta and meta.active is False:
    raise HTTPException(status_code=404, detail="Exercicio arquivado")
  if ex.professor_id is not None:
    if current.type == UserType.PROFESSOR:
      if ex.professor_id != current.id:
        raise HTTPException(status_code=403, detail="Exercicio nao pertence a voce")
    elif current.type == UserType.ALUNO:
      student = _get_student(db, current)
      if not student or ex.professor_id != student.professor_id:
        raise HTTPException(status_code=403, detail="Exercício não pertence ao seu professor")
    else:
      raise HTTPException(status_code=403, detail="Perfil não autorizado")
  ex.active = True if not meta else meta.active
  return ex


@router.patch("/{exercise_id}", response_model=ExerciseOut)
def update_exercise(
  exercise_id: int,
  payload: ExerciseUpdate,
  db: Session = Depends(get_db),
  current: User = Depends(get_current_user),
):
  if current.type != UserType.PROFESSOR:
    raise HTTPException(status_code=403, detail="Apenas professor pode editar exercícios")
  ex = db.get(Exercise, exercise_id)
  if not ex:
    raise HTTPException(status_code=404, detail="Exercicio nao encontrado")
  meta = db.get(ExerciseMeta, exercise_id)
  if meta and meta.active is False:
    raise HTTPException(status_code=404, detail="Exercicio arquivado")
  if ex.professor_id != current.id:
    raise HTTPException(status_code=403, detail="Exercicio nao pertence a voce")

  update_data = payload.model_dump(exclude_unset=True)
  for field, value in update_data.items():
    setattr(ex, field, value)
  db.add(ex)
  db.commit()
  db.refresh(ex)
  ex.active = True
  return ex


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(
  exercise_id: int,
  db: Session = Depends(get_db),
  current: User = Depends(get_current_user),
):
  if current.type != UserType.PROFESSOR:
    raise HTTPException(status_code=403, detail="Apenas professor pode excluir exercicios")
  ex = db.get(Exercise, exercise_id)
  if not ex:
    raise HTTPException(status_code=404, detail="Exercicio nao encontrado")
  if ex.professor_id != current.id:
    raise HTTPException(status_code=403, detail="Exercicio nao pertence a voce")

  now = datetime.utcnow()
  meta = db.get(ExerciseMeta, exercise_id)
  if not meta:
    meta = ExerciseMeta(exercise_id=exercise_id, active=False, archived_at=now)
  else:
    meta.active = False
    meta.archived_at = now
  db.add(meta)
  db.commit()
  return JSONResponse(status_code=204, content=None)
