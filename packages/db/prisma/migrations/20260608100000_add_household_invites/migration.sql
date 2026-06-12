-- CreateTable
CREATE TABLE "household_invites" (
    "id"          TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "invitedBy"   TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "role"        "Role" NOT NULL DEFAULT 'MEMBER',
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "household_invites_token_key" ON "household_invites"("token");

-- CreateIndex
CREATE INDEX "household_invites_token_idx" ON "household_invites"("token");

-- CreateIndex
CREATE INDEX "household_invites_email_idx" ON "household_invites"("email");

-- AddForeignKey
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_householdId_fkey"
    FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
