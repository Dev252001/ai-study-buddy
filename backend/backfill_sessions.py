"""
Backfill a StudySession row for the existing accumulated study hours
so the weekly chart has data to display.
"""
import asyncio
import uuid
from datetime import datetime, timezone, date, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

UTC = timezone.utc
engine = create_async_engine("sqlite+aiosqlite:///./studybuddy_dev.db")
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def main():
    async with Session() as db:
        # Get all users with accumulated hours but no sessions
        r = await db.execute(text(
            "SELECT ua.user_id, ua.total_study_hours "
            "FROM user_analytics ua "
            "WHERE ua.total_study_hours > 0 "
            "AND NOT EXISTS (SELECT 1 FROM study_sessions ss WHERE ss.user_id = ua.user_id)"
        ))
        rows = r.fetchall()
        print(f"Found {len(rows)} users needing backfill")

        for row in rows:
            user_id = row[0]
            total_hours = row[1]
            total_minutes = round(total_hours * 60)

            # Spread across last 3 days so the chart looks natural
            now = datetime.now(UTC)
            days_data = [
                (now - timedelta(days=2), max(1, total_minutes // 3)),
                (now - timedelta(days=1), max(1, total_minutes // 3)),
                (now,                     total_minutes - 2 * (total_minutes // 3)),
            ]

            for ts, mins in days_data:
                if mins <= 0:
                    continue
                session_id = str(uuid.uuid4())
                await db.execute(text(
                    "INSERT INTO study_sessions "
                    "(id, user_id, activity_type, started_at, ended_at, duration_minutes, session_metadata) "
                    "VALUES (:sid, :uid, 'backfill', :started, :ended, :mins, '{}')"
                ), {
                    "sid": session_id,
                    "uid": user_id,
                    "started": ts.isoformat(),
                    "ended": ts.isoformat(),
                    "mins": mins,
                })
                print(f"  Inserted {mins} min for user {user_id} on {ts.date()}")

        await db.commit()
        print("Backfill complete.")

        # Verify
        r2 = await db.execute(text(
            "SELECT user_id, activity_type, started_at, duration_minutes "
            "FROM study_sessions ORDER BY started_at DESC LIMIT 10"
        ))
        print("\nCurrent sessions:")
        for row in r2.fetchall():
            print(dict(row._mapping))


asyncio.run(main())
