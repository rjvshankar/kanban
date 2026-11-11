-- Long-term archive for boards deleted longer than ArchivePolicy.RetentionDays ago.
-- Mirrors the live tables (same columns + PurgedAt), original ids kept, no identity, no FKs.
-- IMPORTANT: any future migration that adds/changes a column on Boards/Columns/Cards/BoardMembers
-- must make the same change here AND update PurgeArchivedBoards / RestorePurgedBoard below.

CREATE TABLE dbo.DeletedBoards (
    Id              INT           NOT NULL CONSTRAINT PK_DeletedBoards PRIMARY KEY,
    Name            NVARCHAR(200) NOT NULL,
    CreatedByUserId INT           NOT NULL,
    CreatedAt       DATETIME2     NOT NULL,
    DeletedAt       DATETIME2     NULL,
    PurgedAt        DATETIME2     NOT NULL
);

CREATE TABLE dbo.DeletedBoardMembers (
    BoardId   INT         NOT NULL,
    UserId    INT         NOT NULL,
    Role      VARCHAR(10) NOT NULL,
    CreatedAt DATETIME2   NOT NULL,
    PurgedAt  DATETIME2   NOT NULL,
    CONSTRAINT PK_DeletedBoardMembers PRIMARY KEY (BoardId, UserId)
);

CREATE INDEX IX_DeletedBoardMembers_UserId ON dbo.DeletedBoardMembers (UserId);

CREATE TABLE dbo.DeletedColumns (
    Id        INT           NOT NULL CONSTRAINT PK_DeletedColumns PRIMARY KEY,
    BoardId   INT           NOT NULL,
    Name      NVARCHAR(200) NOT NULL,
    Position  INT           NOT NULL,
    CreatedAt DATETIME2     NOT NULL,
    DeletedAt DATETIME2     NULL,
    PurgedAt  DATETIME2     NOT NULL
);

CREATE INDEX IX_DeletedColumns_BoardId ON dbo.DeletedColumns (BoardId);

CREATE TABLE dbo.DeletedCards (
    Id          INT            NOT NULL CONSTRAINT PK_DeletedCards PRIMARY KEY,
    ColumnId    INT            NOT NULL,
    Title       NVARCHAR(200)  NOT NULL,
    Description NVARCHAR(4000) NULL,
    DueDate     DATE           NULL,
    Position    INT            NOT NULL,
    CreatedAt   DATETIME2      NOT NULL,
    UpdatedAt   DATETIME2      NOT NULL,
    DeletedAt   DATETIME2      NULL,
    PurgedAt    DATETIME2      NOT NULL
);

CREATE INDEX IX_DeletedCards_ColumnId ON dbo.DeletedCards (ColumnId);
GO

-- Moves every board archived at least @RetentionDays ago (with its members, columns and cards,
-- including individually soft-deleted columns/cards) into the Deleted* tables.
-- Batched: one transaction per batch. Returns the number of boards purged.
CREATE PROCEDURE dbo.PurgeArchivedBoards
    @RetentionDays INT,
    @BatchSize     INT = 100
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Total INT = 0, @N INT, @PurgedAt DATETIME2;
    CREATE TABLE #Batch (Id INT NOT NULL PRIMARY KEY);

    WHILE 1 = 1
    BEGIN
        DELETE FROM #Batch;

        INSERT INTO #Batch (Id)
        SELECT TOP (@BatchSize) Id
        FROM dbo.Boards
        WHERE DeletedAt IS NOT NULL AND DeletedAt <= DATEADD(DAY, -@RetentionDays, SYSUTCDATETIME())
        ORDER BY Id;

        SET @N = @@ROWCOUNT;
        IF @N = 0 BREAK;

        SET @PurgedAt = SYSUTCDATETIME();

        BEGIN TRANSACTION;

        DELETE c
        OUTPUT deleted.Id, deleted.ColumnId, deleted.Title, deleted.Description, deleted.DueDate, deleted.Position,
               deleted.CreatedAt, deleted.UpdatedAt, deleted.DeletedAt, @PurgedAt
        INTO dbo.DeletedCards (Id, ColumnId, Title, Description, DueDate, Position, CreatedAt, UpdatedAt, DeletedAt, PurgedAt)
        FROM dbo.Cards c
        JOIN dbo.Columns col ON col.Id = c.ColumnId
        JOIN #Batch b ON b.Id = col.BoardId;

        DELETE col
        OUTPUT deleted.Id, deleted.BoardId, deleted.Name, deleted.Position, deleted.CreatedAt, deleted.DeletedAt, @PurgedAt
        INTO dbo.DeletedColumns (Id, BoardId, Name, Position, CreatedAt, DeletedAt, PurgedAt)
        FROM dbo.Columns col
        JOIN #Batch b ON b.Id = col.BoardId;

        DELETE m
        OUTPUT deleted.BoardId, deleted.UserId, deleted.Role, deleted.CreatedAt, @PurgedAt
        INTO dbo.DeletedBoardMembers (BoardId, UserId, Role, CreatedAt, PurgedAt)
        FROM dbo.BoardMembers m
        JOIN #Batch b ON b.Id = m.BoardId;

        DELETE bd
        OUTPUT deleted.Id, deleted.Name, deleted.CreatedByUserId, deleted.CreatedAt, deleted.DeletedAt, @PurgedAt
        INTO dbo.DeletedBoards (Id, Name, CreatedByUserId, CreatedAt, DeletedAt, PurgedAt)
        FROM dbo.Boards bd
        JOIN #Batch b ON b.Id = bd.Id;

        COMMIT TRANSACTION;

        SET @Total += @N;
    END

    SELECT @Total AS PurgedBoards;
END
GO

-- Moves a purged board back into the live tables as an ARCHIVED board (DeletedAt = now), so it
-- appears in the owner's archived list and gets a fresh retention window. Only someone who was
-- an owner when the board was purged may do this. Returns 1 on success, 0 otherwise.
CREATE PROCEDURE dbo.RestorePurgedBoard
    @BoardId INT,
    @UserId  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.DeletedBoardMembers WHERE BoardId = @BoardId AND UserId = @UserId AND Role = 'owner')
       OR NOT EXISTS (SELECT 1 FROM dbo.DeletedBoards WHERE Id = @BoardId)
    BEGIN
        SELECT 0 AS Restored;
        RETURN;
    END

    BEGIN TRANSACTION;

    SET IDENTITY_INSERT dbo.Boards ON;
    INSERT INTO dbo.Boards (Id, Name, CreatedByUserId, CreatedAt, DeletedAt)
    SELECT Id, Name, CreatedByUserId, CreatedAt, SYSUTCDATETIME()
    FROM dbo.DeletedBoards WHERE Id = @BoardId;
    SET IDENTITY_INSERT dbo.Boards OFF;

    INSERT INTO dbo.BoardMembers (BoardId, UserId, Role, CreatedAt)
    SELECT BoardId, UserId, Role, CreatedAt
    FROM dbo.DeletedBoardMembers WHERE BoardId = @BoardId;

    SET IDENTITY_INSERT dbo.Columns ON;
    INSERT INTO dbo.Columns (Id, BoardId, Name, Position, CreatedAt, DeletedAt)
    SELECT Id, BoardId, Name, Position, CreatedAt, DeletedAt
    FROM dbo.DeletedColumns WHERE BoardId = @BoardId;
    SET IDENTITY_INSERT dbo.Columns OFF;

    SET IDENTITY_INSERT dbo.Cards ON;
    INSERT INTO dbo.Cards (Id, ColumnId, Title, Description, DueDate, Position, CreatedAt, UpdatedAt, DeletedAt)
    SELECT c.Id, c.ColumnId, c.Title, c.Description, c.DueDate, c.Position, c.CreatedAt, c.UpdatedAt, c.DeletedAt
    FROM dbo.DeletedCards c
    JOIN dbo.DeletedColumns col ON col.Id = c.ColumnId
    WHERE col.BoardId = @BoardId;
    SET IDENTITY_INSERT dbo.Cards OFF;

    DELETE c FROM dbo.DeletedCards c JOIN dbo.DeletedColumns col ON col.Id = c.ColumnId WHERE col.BoardId = @BoardId;
    DELETE FROM dbo.DeletedColumns      WHERE BoardId = @BoardId;
    DELETE FROM dbo.DeletedBoardMembers WHERE BoardId = @BoardId;
    DELETE FROM dbo.DeletedBoards       WHERE Id = @BoardId;

    COMMIT TRANSACTION;

    SELECT 1 AS Restored;
END
