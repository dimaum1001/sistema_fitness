from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Student, User, UserType
from ..schemas import StudentOut
from ..core.security import get_current_user

router = APIRouter()


@router.get("/", response_model=List[StudentOut])
def list_students(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type != UserType.PROFESSOR:
        raise HTTPException(status_code=403, detail="Apenas professor pode listar alunos")

    students = (
        db.query(Student)
        .join(User, Student.user_id == User.id)
        .filter(Student.professor_id == current.id)
        .all()
    )
    # Monta saída com dados do usuário.
    result = []
    for s in students:
        result.append(
            StudentOut(
                id=s.id,
                user_id=s.user_id,
                professor_id=s.professor_id,
                name=s.user.name,
                email=s.user.email,
                type=s.user.type,
            )
        )
    return result
