from datetime import datetime
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Exercise,
    Student,
    TrainingExecution,
    TrainingPlan,
    TrainingSession,
    TrainingSessionExercise,
    User,
    UserConsent,
    UserType,
)
from ..schemas import AccountUpdate, ConsentStatus, ConsentUpdate, UserOut
from ..core.security import get_current_user, get_password_hash
from .executions import _execution_to_payload, _parse_params

router = APIRouter()

TERMS_VERSION = "1.0"
PRIVACY_VERSION = "1.0"
SENSITIVE_VERSION = "1.0"


def _user_payload(user: User) -> Dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "type": getattr(user.type, "value", user.type),
        "created_at": user.created_at,
        "active": user.active,
    }


def _consent_status(consent: Optional[UserConsent]) -> ConsentStatus:
    terms_ok = bool(
        consent
        and consent.terms_version == TERMS_VERSION
        and consent.terms_accepted_at
    )
    privacy_ok = bool(
        consent
        and consent.privacy_version == PRIVACY_VERSION
        and consent.privacy_accepted_at
    )
    sensitive_ok = bool(
        consent
        and consent.sensitive_version == SENSITIVE_VERSION
        and consent.sensitive_accepted_at
    )
    return ConsentStatus(
        accepted=bool(terms_ok and privacy_ok and sensitive_ok),
        terms_version=TERMS_VERSION,
        privacy_version=PRIVACY_VERSION,
        sensitive_version=SENSITIVE_VERSION,
        terms_accepted_at=consent.terms_accepted_at if consent else None,
        privacy_accepted_at=consent.privacy_accepted_at if consent else None,
        sensitive_accepted_at=consent.sensitive_accepted_at if consent else None,
    )


def _get_consent(db: Session, user_id: int) -> Optional[UserConsent]:
    return db.query(UserConsent).filter_by(user_id=user_id).first()


def _anonymize_user(user: User) -> None:
    suffix = f"{user.id}-{int(datetime.utcnow().timestamp())}"
    user.name = "Usuario removido"
    user.email = f"deleted+{suffix}@example.invalid"
    user.hashed_password = get_password_hash(secrets.token_urlsafe(16))
    user.active = False


@router.get("/consent", response_model=ConsentStatus)
def get_consent(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    consent = _get_consent(db, current.id)
    return _consent_status(consent)


@router.post("/consent", response_model=ConsentStatus)
def accept_consent(
    payload: ConsentUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not (payload.accept_terms and payload.accept_privacy and payload.accept_sensitive):
        raise HTTPException(
            status_code=400,
            detail="Todos os consentimentos sao obrigatorios para usar o sistema",
        )
    consent = _get_consent(db, current.id)
    now = datetime.utcnow()
    if not consent:
        consent = UserConsent(
            user_id=current.id,
            terms_version=TERMS_VERSION,
            privacy_version=PRIVACY_VERSION,
            sensitive_version=SENSITIVE_VERSION,
        )
    consent.terms_version = TERMS_VERSION
    consent.privacy_version = PRIVACY_VERSION
    consent.sensitive_version = SENSITIVE_VERSION
    consent.terms_accepted_at = now
    consent.privacy_accepted_at = now
    consent.sensitive_accepted_at = now
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return _consent_status(consent)


@router.delete("/consent", response_model=ConsentStatus)
def revoke_consent(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    consent = _get_consent(db, current.id)
    if not consent:
        return _consent_status(None)
    consent.terms_accepted_at = None
    consent.privacy_accepted_at = None
    consent.sensitive_accepted_at = None
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return _consent_status(consent)


@router.patch("/me", response_model=UserOut)
def update_account(
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not current.active:
        raise HTTPException(status_code=403, detail="Conta desativada")
    update_data = payload.model_dump(exclude_unset=True)
    new_email = update_data.get("email")
    if new_email and new_email != current.email:
        existing = db.query(User).filter(User.email == new_email, User.id != current.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email ja cadastrado")
        current.email = new_email
    if "name" in update_data and update_data["name"]:
        current.name = update_data["name"]
    if update_data.get("password"):
        current.hashed_password = get_password_hash(update_data["password"])
    db.add(current)
    db.commit()
    db.refresh(current)
    return current


@router.get("/export")
def export_my_data(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    consent = _get_consent(db, current.id)
    payload: Dict[str, Any] = {
        "user": _user_payload(current),
        "consent": _consent_status(consent).model_dump(),
    }

    if current.type != UserType.ALUNO:
        return payload

    student = db.query(Student).filter_by(user_id=current.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno nao encontrado")

    plans = (
        db.query(TrainingPlan)
        .filter_by(student_id=student.id)
        .order_by(TrainingPlan.id.asc())
        .all()
    )
    sessions = (
        db.query(TrainingSession)
        .join(TrainingPlan, TrainingPlan.id == TrainingSession.plan_id)
        .filter(TrainingPlan.student_id == student.id)
        .order_by(TrainingSession.sequence.asc(), TrainingSession.id.asc())
        .all()
    )
    session_ex_rows = (
        db.query(TrainingSessionExercise, Exercise)
        .join(TrainingSession, TrainingSessionExercise.session_id == TrainingSession.id)
        .join(TrainingPlan, TrainingPlan.id == TrainingSession.plan_id)
        .join(Exercise, Exercise.id == TrainingSessionExercise.exercise_id)
        .filter(TrainingPlan.student_id == student.id)
        .order_by(TrainingSessionExercise.session_id.asc(), TrainingSessionExercise.order.asc())
        .all()
    )
    executions = (
        db.query(TrainingExecution)
        .filter_by(student_id=student.id)
        .order_by(TrainingExecution.executed_at.desc())
        .all()
    )

    payload.update(
        {
            "student": {
                "id": student.id,
                "user_id": student.user_id,
                "professor_id": student.professor_id,
                "notes": student.notes,
            },
            "plans": [
                {
                    "id": p.id,
                    "name": p.name,
                    "goal": p.goal,
                    "start_date": p.start_date,
                    "end_date": p.end_date,
                    "notes": p.notes,
                }
                for p in plans
            ],
            "sessions": [
                {
                    "id": s.id,
                    "plan_id": s.plan_id,
                    "name": s.name,
                    "sequence": s.sequence,
                    "main_type": s.main_type,
                    "notes": s.notes,
                }
                for s in sessions
            ],
            "session_exercises": [
                {
                    "id": sess_ex.id,
                    "session_id": sess_ex.session_id,
                    "exercise_id": sess_ex.exercise_id,
                    "order": sess_ex.order,
                    "params": _parse_params(sess_ex.params),
                    "notes": sess_ex.notes,
                    "exercise": {
                        "name": ex.name if ex else None,
                        "type": ex.type if ex else None,
                        "group": ex.group if ex else None,
                    },
                }
                for sess_ex, ex in session_ex_rows
            ],
            "executions": [_execution_to_payload(db, e).model_dump() for e in executions],
        }
    )
    return payload


@router.delete("/me", status_code=204, response_class=Response)
def delete_my_account(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.type == UserType.PROFESSOR:
        linked = db.query(Student).filter_by(professor_id=current.id).first()
        if linked:
            raise HTTPException(
                status_code=409,
                detail="Professor possui alunos vinculados. Transfira os alunos antes de excluir.",
            )
    if current.type == UserType.ADMIN:
        other_admin = (
            db.query(User)
            .filter(User.type == UserType.ADMIN, User.id != current.id, User.active.is_(True))
            .first()
        )
        if not other_admin:
            raise HTTPException(
                status_code=409,
                detail="Nao e possivel excluir o ultimo admin ativo.",
            )

    if current.type == UserType.ALUNO:
        student = db.query(Student).filter_by(user_id=current.id).first()
        if student:
            student.notes = None
            db.add(student)

    consent = _get_consent(db, current.id)
    if consent:
        db.delete(consent)

    _anonymize_user(current)
    db.add(current)
    db.commit()
    return Response(status_code=204)
