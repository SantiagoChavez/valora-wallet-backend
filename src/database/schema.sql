-- Habilitar extensión para generación de UUIDs v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Borrado preventivo de tablas para asegurar inicialización limpia
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS balances CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Tabla de Usuarios
-- Almacena los datos principales de registro, seguridad (hasheo) y perfil.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tabla de Billeteras (Wallets)
-- Relación 1:1 con el usuario. Cada usuario posee una billetera única.
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tabla de Saldos (Balances)
-- Registra los montos disponibles por moneda (USD, EUR, ARS) de la billetera.
CREATE TABLE balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    currency_code VARCHAR(10) NOT NULL,
    amount NUMERIC(18,8) NOT NULL DEFAULT 0.00000000 CHECK (amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_wallet_currency UNIQUE (wallet_id, currency_code)
);

-- Tabla de Transacciones
-- Ledger inmutable que audita compras, ventas e intercambios de divisas.
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'EXCHANGE', 'DEPOSIT')),
    source_currency VARCHAR(10),
    target_currency VARCHAR(10),
    source_amount NUMERIC(18,8),
    target_amount NUMERIC(18,8),
    exchange_rate NUMERIC(18,8),
    resulting_balance NUMERIC(18,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índices de Rendimiento
-- Optimizan búsquedas frecuentes por billetera y filtrado en transacciones.
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_balances_wallet_id ON balances(wallet_id);
