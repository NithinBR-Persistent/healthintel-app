from __future__ import annotations

import sqlite3
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

from healthintel_api.data.seed import seed_appeals
from healthintel_api.domain.models import AppealCase


class AppealRepository:
    """SQLite-backed appeal repository for the hackathon prototype."""

    def __init__(self, database_path: str | Path) -> None:
        self._database_path = Path(database_path)
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()
        self._seed_if_empty()

    def list(self) -> list[AppealCase]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT payload FROM appeals ORDER BY rowid"
            ).fetchall()

        return [AppealCase.model_validate_json(row["payload"]) for row in rows]

    def get(self, appeal_id: str) -> AppealCase | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload FROM appeals WHERE id = ?",
                (appeal_id,),
            ).fetchone()

        if row is None:
            return None

        return AppealCase.model_validate_json(row["payload"])

    def save(self, appeal: AppealCase) -> AppealCase:
        appeal_to_save = appeal.model_copy(deep=True)
        with self._connect() as connection:
            self._upsert(connection, appeal_to_save)

        return appeal_to_save

    def reset(self) -> list[AppealCase]:
        with self._connect() as connection:
            connection.execute("DELETE FROM appeals")
            self._save_many(connection, seed_appeals())

        return self.list()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS appeals (
                  id TEXT PRIMARY KEY,
                  payload TEXT NOT NULL,
                  updated_at TEXT NOT NULL
                )
                """
            )

    def _seed_if_empty(self) -> None:
        with self._connect() as connection:
            appeal_count = connection.execute(
                "SELECT COUNT(*) FROM appeals"
            ).fetchone()[0]

            if appeal_count == 0:
                self._save_many(connection, seed_appeals())

    def _save_many(
        self,
        connection: sqlite3.Connection,
        appeals: Iterable[AppealCase],
    ) -> None:
        for appeal in appeals:
            self._upsert(connection, appeal)

    def _upsert(self, connection: sqlite3.Connection, appeal: AppealCase) -> None:
        connection.execute(
            """
            INSERT INTO appeals (id, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              payload = excluded.payload,
              updated_at = excluded.updated_at
            """,
            (
                appeal.id,
                appeal.model_dump_json(by_alias=True),
                datetime.now(UTC).isoformat(),
            ),
        )
