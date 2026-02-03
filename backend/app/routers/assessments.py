from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..database import get_db
from ..models import Student, StudentAssessment, User, UserType
from ..schemas import StudentAssessmentCreate, StudentAssessmentOut, StudentAssessmentUpdate

router = APIRouter()


def _ensure_professor_student(db: Session, student_id: int, professor_id: int) -> Student:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")
    if student.professor_id != professor_id:
        raise HTTPException(status_code=403, detail="Aluno nao pertence a este professor")
    return student


def _auto_bmi(weight_kg: Optional[float], height_cm: Optional[float]) -> Optional[float]:
    if not weight_kg or not height_cm:
        return None
    height_m = height_cm / 100
    if height_m <= 0:
        return None
    return round(weight_kg / (height_m * height_m), 2)


def _ensure_professor_assessment(db: Session, assessment_id: int, professor_id: int) -> StudentAssessment:
    assessment = db.get(StudentAssessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Avaliacao nao encontrada")
    if assessment.professor_id != professor_id:
        raise HTTPException(status_code=403, detail="Avaliacao nao pertence a este professor")
    _ensure_professor_student(db, assessment.student_id, professor_id)
    return assessment


@router.post("/", response_model=StudentAssessmentOut)
def create_assessment(
    payload: StudentAssessmentCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode salvar avaliacao")

    student = _ensure_professor_student(db, payload.student_id, current.id)
    data = payload.model_dump(exclude={"student_id"}, exclude_none=True)
    if "bmi" not in data:
        auto_bmi = _auto_bmi(data.get("weight_kg"), data.get("height_cm"))
        if auto_bmi is not None:
            data["bmi"] = auto_bmi

    assessment = StudentAssessment(
        student_id=student.id,
        professor_id=current.id,
        **data,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get("/aluno/{student_id}", response_model=List[StudentAssessmentOut])
def list_assessments(
    student_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode consultar avaliacao")
    _ensure_professor_student(db, student_id, current.id)
    return (
        db.query(StudentAssessment)
        .filter(StudentAssessment.student_id == student_id, StudentAssessment.professor_id == current.id)
        .order_by(StudentAssessment.evaluated_at.desc(), StudentAssessment.id.desc())
        .all()
    )


@router.patch("/{assessment_id}", response_model=StudentAssessmentOut)
def update_assessment(
    assessment_id: int,
    payload: StudentAssessmentUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode atualizar avaliacao")

    assessment = _ensure_professor_assessment(db, assessment_id, current.id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="Nenhum campo enviado para atualizacao")

    for field, value in data.items():
        setattr(assessment, field, value)

    if "bmi" not in data and ("weight_kg" in data or "height_cm" in data):
        assessment.bmi = _auto_bmi(assessment.weight_kg, assessment.height_cm)

    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.delete("/{assessment_id}", status_code=204)
def delete_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode excluir avaliacao")

    assessment = _ensure_professor_assessment(db, assessment_id, current.id)
    db.delete(assessment)
    db.commit()
