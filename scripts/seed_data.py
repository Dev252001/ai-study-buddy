"""
Seed script: populates the database with sample data for testing.
Usage: python scripts/seed_data.py
"""
import sys
import os
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User
from app.models.document import Document
from app.models.quiz import Quiz, QuizQuestion
from app.models.flashcard import FlashcardSet, Flashcard
from app.models.analytics import UserAnalytics
from app.core.database import Base

SYNC_DB_URL = os.getenv(
    'SYNC_DATABASE_URL',
    'postgresql+psycopg2://studybuddy:studybuddy@localhost:5432/studybuddy'
)

engine = create_engine(SYNC_DB_URL)
SessionLocal = sessionmaker(bind=engine)

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── Users ─────────────────────────────────────────────────────────────
        if db.query(User).filter_by(email='admin@studybuddy.ai').first():
            print("Database already seeded. Skipping.")
            return

        admin_id = str(uuid.uuid4())
        student_id = str(uuid.uuid4())

        admin = User(
            id=admin_id,
            email='admin@studybuddy.ai',
            username='admin',
            hashed_password=hash_password('Admin@1234'),
            full_name='Admin User',
            is_active=True,
            is_admin=True,
            is_verified=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        student = User(
            id=student_id,
            email='student@studybuddy.ai',
            username='student',
            hashed_password=hash_password('Student@1234'),
            full_name='Jane Student',
            bio='Passionate about learning AI and Machine Learning.',
            is_active=True,
            is_verified=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        db.add_all([admin, student])
        db.flush()

        # ── Analytics ─────────────────────────────────────────────────────────
        for user_id, docs, questions, quizzes, hours in [
            (admin_id, 5, 20, 3, 4.5),
            (student_id, 8, 45, 12, 15.2),
        ]:
            db.add(UserAnalytics(
                id=str(uuid.uuid4()),
                user_id=user_id,
                total_documents=docs,
                total_questions_asked=questions,
                total_quizzes_taken=quizzes,
                total_flashcards_reviewed=25,
                total_study_hours=hours,
                avg_quiz_score=72.5,
                streak_days=3,
                last_active=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            ))

        # ── Documents ─────────────────────────────────────────────────────────
        doc_ids = []
        for title, ftype in [
            ('Introduction to Machine Learning', 'pdf'),
            ('Python Programming Guide', 'pdf'),
            ('Data Structures & Algorithms', 'docx'),
        ]:
            doc_id = str(uuid.uuid4())
            doc_ids.append(doc_id)
            db.add(Document(
                id=doc_id,
                user_id=student_id,
                title=title,
                filename=f"{title.lower().replace(' ', '_')}.{ftype}",
                file_path=f"uploads/{student_id}/{title.lower().replace(' ', '_')}.{ftype}",
                file_type=ftype,
                file_size=1024 * 256,
                status='ready',
                page_count=45,
                word_count=12500,
                char_count=75000,
                tags=['study', 'course'],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            ))

        # ── Quizzes ───────────────────────────────────────────────────────────
        quiz_id = str(uuid.uuid4())
        quiz = Quiz(
            id=quiz_id,
            user_id=student_id,
            document_id=doc_ids[0] if doc_ids else None,
            title='Machine Learning Basics',
            quiz_type='mcq',
            difficulty='medium',
            total_questions=3,
            created_at=datetime.now(timezone.utc),
        )
        db.add(quiz)
        db.flush()

        questions = [
            ('What is supervised learning?',
             ['Training with labeled data', 'Training without labels', 'Using reinforcement', 'None of the above'],
             'Training with labeled data',
             'Supervised learning uses labeled training data to learn the mapping function.'),
            ('Which algorithm is used for classification?',
             ['Linear Regression', 'K-Means', 'Random Forest', 'PCA'],
             'Random Forest',
             'Random Forest is an ensemble method used for classification and regression.'),
            ('What does "overfitting" mean?',
             ['Model performs too well on training data', 'Model is too simple', 'Model has no parameters', 'Model uses too little data'],
             'Model performs too well on training data',
             'Overfitting occurs when a model learns noise in training data, hurting generalization.'),
        ]

        for i, (qtext, opts, correct, expl) in enumerate(questions):
            db.add(QuizQuestion(
                id=str(uuid.uuid4()),
                quiz_id=quiz_id,
                question_text=qtext,
                question_type='mcq',
                options=opts,
                correct_answer=correct,
                explanation=expl,
                order_index=i,
            ))

        # ── Flashcards ────────────────────────────────────────────────────────
        set_id = str(uuid.uuid4())
        flashcard_set = FlashcardSet(
            id=set_id,
            user_id=student_id,
            title='ML Key Concepts',
            description='Essential machine learning terminology and concepts',
            topic='Machine Learning',
            difficulty='medium',
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(flashcard_set)
        db.flush()

        cards = [
            ('What is a Neural Network?', 'A computational model inspired by the structure of biological neurons, consisting of interconnected layers of nodes.', 'Think of it like a brain'),
            ('What is Gradient Descent?', 'An optimization algorithm that minimizes the loss function by iteratively moving in the direction of the steepest descent.', 'Walk downhill to find the valley'),
            ('What is Cross-Validation?', 'A technique to evaluate model generalization by splitting data into training and validation folds multiple times.', 'Like practice tests before the real exam'),
        ]

        for i, (front, back, hint) in enumerate(cards):
            db.add(Flashcard(
                id=str(uuid.uuid4()),
                set_id=set_id,
                front=front,
                back=back,
                hint=hint,
                topic='Machine Learning',
                difficulty='medium',
                order_index=i,
                times_reviewed=0,
                times_correct=0,
            ))

        db.commit()
        print("✅ Database seeded successfully!")
        print("")
        print("Test accounts:")
        print("  Admin:   admin@studybuddy.ai  / Admin@1234")
        print("  Student: student@studybuddy.ai / Student@1234")

    except Exception as e:
        db.rollback()
        print(f"❌ Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    seed()
