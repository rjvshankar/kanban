CREATE TABLE dbo.PasswordResetTokens (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    UserId     INT          NOT NULL,
    TokenHash  CHAR(64)     NOT NULL,   -- SHA-256 hex of the emailed token; the raw token is never stored
    ExpiresAt  DATETIME2    NOT NULL,
    UsedAt     DATETIME2    NULL,
    CreatedAt  DATETIME2    NOT NULL CONSTRAINT DF_PasswordResetTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PasswordResetTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_PasswordResetTokens_TokenHash UNIQUE (TokenHash)
);

CREATE INDEX IX_PasswordResetTokens_UserId ON dbo.PasswordResetTokens (UserId);
