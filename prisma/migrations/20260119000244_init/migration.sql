-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "amountUsd" REAL NOT NULL,
    "amountToken" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripePaymentStatus" TEXT,
    "mintTxHash" TEXT,
    "transferTxHash" TEXT,
    "burnTxHash" TEXT,
    "paymentMethodId" TEXT,
    "payoutStatus" TEXT,
    "memo" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAddress" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TokenDeployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "deployerAddress" TEXT NOT NULL,
    "deployTxHash" TEXT NOT NULL,
    "feeAmmPoolAddress" TEXT,
    "liquidityTxHash" TEXT,
    "liquidityAmount" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripePaymentIntentId_key" ON "Transaction"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Transaction_userAddress_idx" ON "Transaction"("userAddress");

-- CreateIndex
CREATE INDEX "Transaction_stripePaymentIntentId_idx" ON "Transaction"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "PaymentMethod_userAddress_idx" ON "PaymentMethod"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "TokenDeployment_tokenAddress_key" ON "TokenDeployment"("tokenAddress");
