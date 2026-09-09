const Database = require("better-sqlite3");

const db = new Database("roleta.db");

db.pragma("journal_mode = WAL");


// ========================================
// TABELA
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS giros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        usuario_id TEXT,

        indice INTEGER NOT NULL,

        premio TEXT NOT NULL,

        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);


// ========================================
// MIGRAÇÃO DO BANCO ANTIGO
// ========================================

const colunas =
    db.prepare(`
        PRAGMA table_info(giros)
    `).all();

const nomesColunas =
    colunas.map(
        coluna => coluna.name
    );

if (!nomesColunas.includes("campanha")) {

    db.exec(`
        ALTER TABLE giros
        ADD COLUMN campanha TEXT
    `);
}

if (!nomesColunas.includes("eh_premio")) {

    db.exec(`
        ALTER TABLE giros
        ADD COLUMN eh_premio INTEGER
        NOT NULL DEFAULT 0
    `);
}


// ========================================
// UM GIRO POR USUÁRIO / CAMPANHA
// ========================================

db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_giro_usuario_campanha

    ON giros (
        campanha,
        usuario_id
    )

    WHERE
        campanha IS NOT NULL
        AND usuario_id IS NOT NULL
`);

// ========================================
// ESTADO DA ROLETA
// ========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS estado_roleta (
        id INTEGER PRIMARY KEY
            CHECK (id = 1),

        versao INTEGER
            NOT NULL DEFAULT 1,

        aberta INTEGER
            NOT NULL DEFAULT 0,

        atualizada_em DATETIME
            DEFAULT CURRENT_TIMESTAMP
    )
`);

db.prepare(`
    INSERT OR IGNORE INTO estado_roleta (
        id,
        versao,
        aberta
    )
    VALUES (1, 1, 0)
`).run();

// ========================================
// CONSULTAS
// ========================================

function buscarGiroUsuarioCampanha(
    usuarioId,
    campanha
) {

    return db.prepare(`
        SELECT *

        FROM giros

        WHERE
            usuario_id = ?
            AND campanha = ?

        LIMIT 1
    `).get(
        usuarioId,
        campanha
    );
}


function contarGanhadoresCampanha(
    campanha
) {

    const resultado =
        db.prepare(`
            SELECT COUNT(*) AS total

            FROM giros

            WHERE
                campanha = ?
                AND eh_premio = 1
        `).get(campanha);

    return resultado.total;
}


// ========================================
// REGISTRAR GIRO
// ========================================

const registrarGiroTransaction =
    db.transaction(
        ({
            usuarioId,
            indice,
            premio,
            campanha,
            ehPremio,
            maxGanhadores
        }) => {

            const giroExistente =
                buscarGiroUsuarioCampanha(
                    usuarioId,
                    campanha
                );

            if (giroExistente) {

                return {
                    ok: false,
                    motivo: "ja_girou",
                    giro: giroExistente
                };
            }

            const totalGanhadores =
                contarGanhadoresCampanha(
                    campanha
                );

            if (
                totalGanhadores >=
                maxGanhadores
            ) {

                return {
                    ok: false,
                    motivo: "esgotado",
                    totalGanhadores
                };
            }

            const resultado =
                db.prepare(`
                    INSERT INTO giros (
                        usuario_id,
                        indice,
                        premio,
                        campanha,
                        eh_premio
                    )

                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    usuarioId,
                    indice,
                    premio,
                    campanha,
                    ehPremio ? 1 : 0
                );

            return {
                ok: true,

                giroId:
                    resultado.lastInsertRowid,

                totalGanhadores:
                    totalGanhadores +
                    (ehPremio ? 1 : 0)
            };
        }
    );


function registrarGiroCampanha(dados) {

    return registrarGiroTransaction.immediate(
        dados
    );
}

function obterEstadoRoleta() {

    const estado =
        db.prepare(`
            SELECT
                versao,
                aberta
            FROM estado_roleta
            WHERE id = 1
        `).get();

    return {
        versao:
            Number(estado.versao),

        aberta:
            estado.aberta === 1
    };
}


function abrirRoleta() {

    db.prepare(`
        UPDATE estado_roleta
        SET
            aberta = 1,
            atualizada_em =
                CURRENT_TIMESTAMP
        WHERE id = 1
    `).run();

    return obterEstadoRoleta();
}

function listarGiros() {

    return db.prepare(`
        SELECT *

        FROM giros

        ORDER BY id DESC

        LIMIT 20
    `).all();
}

function zerarRoleta() {

    const transaction =
        db.transaction(() => {

            const antes =
                db.prepare(`
                    SELECT
                        COUNT(*) AS totalGiros,

                        COALESCE(
                            SUM(eh_premio),
                            0
                        ) AS totalGanhadores
                    FROM giros
                `).get();

            db.prepare(`
                DELETE FROM giros
            `).run();

            db.prepare(`
                DELETE FROM sqlite_sequence
                WHERE name = 'giros'
            `).run();

            db.prepare(`
                UPDATE estado_roleta
                SET
                    versao = versao + 1,
                    aberta = 0,
                    atualizada_em =
                        CURRENT_TIMESTAMP
                WHERE id = 1
            `).run();

            const estadoNovo =
                obterEstadoRoleta();

            return {
                girosRemovidos:
                    Number(
                        antes.totalGiros || 0
                    ),

                ganhadoresRemovidos:
                    Number(
                        antes.totalGanhadores || 0
                    ),

                versao:
                    estadoNovo.versao,

                aberta: false
            };
        });

    return transaction.immediate();
}

module.exports = {
    buscarGiroUsuarioCampanha,
    contarGanhadoresCampanha,
    registrarGiroCampanha,
    listarGiros,
    zerarRoleta,
    obterEstadoRoleta,
    abrirRoleta
};