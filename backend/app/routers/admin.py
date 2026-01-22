from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserType
from ..schemas import UserOut
from ..core.security import get_current_user

router = APIRouter()


def _ensure_admin(current: User) -> None:
    if current.type != UserType.ADMIN:
        raise HTTPException(status_code=403, detail="Apenas admin pode acessar este recurso")


@router.get("/professores", response_model=List[UserOut])
def list_professors(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    _ensure_admin(current)
    return (
        db.query(User)
        .filter(User.type == UserType.PROFESSOR)
        .order_by(User.name.asc(), User.id.asc())
        .all()
    )
