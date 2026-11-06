-- Soft delete: rows are never removed, DeletedAt marks them gone. No ON DELETE CASCADE anywhere.
-- Columns/Cards are not reachable once their Board (or Column) is soft-deleted, because queries join up through it.

CREATE TABLE dbo.Boards (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    Name            NVARCHAR(200) NOT NULL,
    CreatedByUserId INT           NOT NULL,
    CreatedAt       DATETIME2     NOT NULL CONSTRAINT DF_Boards_CreatedAt DEFAULT SYSUTCDATETIME(),
    DeletedAt       DATETIME2     NULL,
    CONSTRAINT FK_Boards_Users FOREIGN KEY (CreatedByUserId) REFERENCES dbo.Users(Id)
);

CREATE TABLE dbo.BoardMembers (
    BoardId   INT          NOT NULL,
    UserId    INT          NOT NULL,
    Role      VARCHAR(10)  NOT NULL,
    CreatedAt DATETIME2    NOT NULL CONSTRAINT DF_BoardMembers_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_BoardMembers PRIMARY KEY (BoardId, UserId),
    CONSTRAINT FK_BoardMembers_Boards FOREIGN KEY (BoardId) REFERENCES dbo.Boards(Id),
    CONSTRAINT FK_BoardMembers_Users  FOREIGN KEY (UserId)  REFERENCES dbo.Users(Id),
    CONSTRAINT CK_BoardMembers_Role CHECK (Role IN ('owner', 'editor', 'viewer'))
);

CREATE INDEX IX_BoardMembers_UserId ON dbo.BoardMembers (UserId);

CREATE TABLE dbo.Columns (
    Id        INT IDENTITY(1,1) PRIMARY KEY,
    BoardId   INT           NOT NULL,
    Name      NVARCHAR(200) NOT NULL,
    Position  INT           NOT NULL,   -- gapped (1000, 2000, ...) so a move only rewrites one row
    CreatedAt DATETIME2     NOT NULL CONSTRAINT DF_Columns_CreatedAt DEFAULT SYSUTCDATETIME(),
    DeletedAt DATETIME2     NULL,
    CONSTRAINT FK_Columns_Boards FOREIGN KEY (BoardId) REFERENCES dbo.Boards(Id)
);

CREATE INDEX IX_Columns_BoardId_Position ON dbo.Columns (BoardId, Position);

CREATE TABLE dbo.Cards (
    Id          INT IDENTITY(1,1) PRIMARY KEY,
    ColumnId    INT            NOT NULL,
    Title       NVARCHAR(200)  NOT NULL,
    Description NVARCHAR(4000) NULL,
    DueDate     DATE           NULL,
    Position    INT            NOT NULL,
    CreatedAt   DATETIME2      NOT NULL CONSTRAINT DF_Cards_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2      NOT NULL CONSTRAINT DF_Cards_UpdatedAt DEFAULT SYSUTCDATETIME(),
    DeletedAt   DATETIME2      NULL,
    CONSTRAINT FK_Cards_Columns FOREIGN KEY (ColumnId) REFERENCES dbo.Columns(Id)
);

CREATE INDEX IX_Cards_ColumnId_Position ON dbo.Cards (ColumnId, Position);
