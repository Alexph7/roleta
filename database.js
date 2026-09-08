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


function listarGiros() {

    return db.prepare(`
        SELECT *

        FROM giros

        ORDER BY id DESC

        LIMIT 20
    `).all();
}

function zerarRoleta() {
    const transaction = db.transaction(() => {

        const resultado = db
            .prepare(`
                DELETE FROM giros
            `)
            .run();

        db.prepare(`
            DELETE FROM sqlite_sequence
            WHERE name = 'giros'
        `).run();

        return resultado.changes;
    });

    return transaction.immediate();
}

module.exports = {
    buscarGiroUsuarioCampanha,
    contarGanhadoresCampanha,
    registrarGiroCampanha,
    listarGiros,
    zerarRoleta
};