"""Seed basic test data (users, exercise, plan, session, execution)."""

from datetime import datetime

from app.core.security import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models import (
    Exercise,
    ExerciseType,
    Student,
    TrainingExecution,
    TrainingPlan,
    TrainingSession,
    TrainingSessionExercise,
    User,
    UserType,
    ExecutionStatus,
)

ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "senha123"
PROF_EMAIL = "professor@test.com"
PROF_PASSWORD = "senha123"
STUDENT_EMAIL = "aluno@test.com"
STUDENT_PASSWORD = "senha123"


def upsert_seed() -> None:
    # Ensure tables exist before inserting.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        admin = db.query(User).filter_by(email=ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                name="Admin Teste",
                email=ADMIN_EMAIL,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                type=UserType.ADMIN,
            )
            db.add(admin)
            db.flush()
            print(f"Created admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        else:
            print(f"Admin already exists: {ADMIN_EMAIL}")

        professor = db.query(User).filter_by(email=PROF_EMAIL).first()
        if not professor:
            professor = User(
                name="Professor Teste",
                email=PROF_EMAIL,
                hashed_password=get_password_hash(PROF_PASSWORD),
                type=UserType.PROFESSOR,
            )
            db.add(professor)
            db.flush()  # get ID
            print(f"Created professor: {PROF_EMAIL} / {PROF_PASSWORD}")
        else:
            print(f"Professor already exists: {PROF_EMAIL}")

        student_user = db.query(User).filter_by(email=STUDENT_EMAIL).first()
        if not student_user:
            student_user = User(
                name="Aluno Teste",
                email=STUDENT_EMAIL,
                hashed_password=get_password_hash(STUDENT_PASSWORD),
                type=UserType.ALUNO,
            )
            db.add(student_user)
            db.flush()
            print(f"Created student: {STUDENT_EMAIL} / {STUDENT_PASSWORD}")
        else:
            print(f"Student already exists: {STUDENT_EMAIL}")

        student = db.query(Student).filter_by(user_id=student_user.id).first()
        if not student:
            student = Student(user_id=student_user.id, professor_id=professor.id)
            db.add(student)
            db.flush()
            print("Linked student to professor.")

        # Exercise
        exercise = db.query(Exercise).filter_by(name="Supino reto", professor_id=professor.id).first()
        if not exercise:
            exercise = Exercise(
                professor_id=professor.id,
                name="Supino reto",
                type=ExerciseType.MUSCULACAO,
                group="Peito",
                description="Supino com barra no banco reto.",
                tips="Controle a descida e mantenha escápulas fixas.",
            )
            db.add(exercise)
            db.flush()
            print("Created exercise: Supino reto")

        # Plan
        plan = (
            db.query(TrainingPlan)
            .filter_by(student_id=student.id, name="Hipertrofia 3x/semana")
            .first()
        )
        if not plan:
            plan = TrainingPlan(
                student_id=student.id,
                name="Hipertrofia 3x/semana",
                goal="Força e hipertrofia de superiores",
                notes="Plano exemplo para seed.",
            )
            db.add(plan)
            db.flush()
            print("Created plan: Hipertrofia 3x/semana")

        # Session
        session = (
            db.query(TrainingSession)
            .filter_by(plan_id=plan.id, name="Treino A - Peito e Tríceps")
            .first()
        )
        if not session:
            session = TrainingSession(
                plan_id=plan.id,
                name="Treino A - Peito e Tríceps",
                sequence=1,
                main_type="MUSCULACAO",
                notes="Volume moderado",
            )
            db.add(session)
            db.flush()
            print("Created session: Treino A - Peito e Tríceps")

        # Session exercise
        sess_ex = (
            db.query(TrainingSessionExercise)
            .filter_by(session_id=session.id, exercise_id=exercise.id)
            .first()
        )
        if not sess_ex:
            sess_ex = TrainingSessionExercise(
                session_id=session.id,
                exercise_id=exercise.id,
                order=1,
                params='{"series":3,"reps":10,"carga_sugerida":30}',
            )
            db.add(sess_ex)
            db.flush()
            print("Linked exercise to session.")

        # Execution sample
        existing_exec = (
            db.query(TrainingExecution)
            .filter_by(student_id=student.id, session_id=session.id)
            .order_by(TrainingExecution.executed_at.desc())
            .first()
        )
        if not existing_exec:
            execu = TrainingExecution(
                student_id=student.id,
                session_id=session.id,
                executed_at=datetime.utcnow(),
                status=ExecutionStatus.CONCLUIDO,
                rpe=7,
                comment="Treino confortável.",
            )
            db.add(execu)
            print("Created sample execution.")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    upsert_seed()
