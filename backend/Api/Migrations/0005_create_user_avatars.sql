CREATE TABLE dbo.UserAvatars (
    UserId      INT            NOT NULL PRIMARY KEY,
    ContentType NVARCHAR(50)   NOT NULL,
    Data        VARBINARY(MAX) NOT NULL,
    UpdatedAt   DATETIME2      NOT NULL CONSTRAINT DF_UserAvatars_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_UserAvatars_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (Id) ON DELETE CASCADE
);
