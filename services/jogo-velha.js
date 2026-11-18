// Jogo da Velha - duelo entre 2 pessoas (melhor de 3).
// O servidor é o juiz: tabuleiro, vez, rodadas e vitórias.
// Contra o bot roda só no celular e não passa por aqui.

const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const caminhoBanco =
    process.env.MEMORIA_DB_PATH ||
    path.join(__dirname, "..", "roleta.db");

const db = new Database(caminhoBanco);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

// ==============================
// CONFIGURAÇÃO
// ==============================

const CONVITE_EXPIRA_MS = 3 * 60 * 1000;   // convite some em 3 min
const INTERVALO_CONVITE_MS = 60 * 1000;    // 1 convite por minuto
const TEMPO_VEZ_MS = 30 * 1000;            // 15 s por jogada
const MAX_PERDAS_VEZ = 3;                  // 3 vezes seguidas = abandono
const PAUSA_INICIO_MS = 3000;
const SUMIU_MS = 30 * 1000;                // sem sinal por 30 s = saiu da partida
const PAUSA_RODADA_MS = 2800;              // mostra o fim da rodada
const VITORIAS_PARA_GANHAR = 2;            // quem vence 2 leva
const MAX_RODADAS = 3;                     // no máximo 3 rodadas, contando empates

const LINHAS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// ==============================
// TABELA
// ==============================

db.exec(`
    CREATE TABLE IF NOT EXISTS velha_duelos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'aguardando',
        jogador1_id TEXT NOT NULL,
        jogador2_id TEXT,
        tabuleiro TEXT NOT NULL DEFAULT '.........',
        rodada INTEGER NOT NULL DEFAULT 1,
        quem_comecou INTEGER,
        vez INTEGER,
        vez_inicio INTEGER,
        vitorias1 INTEGER NOT NULL DEFAULT 0,
        vitorias2 INTEGER NOT NULL DEFAULT 0,
        empates INTEGER NOT NULL DEFAULT 0,
        perdas_vez1 INTEGER NOT NULL DEFAULT 0,
        perdas_vez2 INTEGER NOT NULL DEFAULT 0,
        seq INTEGER NOT NULL DEFAULT 0,
        ultima_json TEXT,
        vencedor INTEGER,
        motivo_fim TEXT,
        msg_chat_id TEXT,
        msg_id INTEGER,
        msg_apagada INTEGER NOT NULL DEFAULT 0,
        msg_tentativas INTEGER NOT NULL DEFAULT 0,
        criado_em INTEGER NOT NULL,
        expira_em INTEGER NOT NULL,
        iniciado_em INTEGER,
        finalizado_em INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_velha_status ON velha_duelos (status);
    CREATE INDEX IF NOT EXISTS idx_velha_j1 ON velha_duelos (jogador1_id, criado_em);
    CREATE INDEX IF NOT EXISTS idx_velha_j2 ON velha_duelos (jogador2_id);
`);

// Colunas novas: última vez que cada jogador deu sinal
for (const coluna of ["visto1", "visto2"]) {
    const existe = db.prepare(`PRAGMA table_info(velha_duelos)`).all()
        .some(c => c.name === coluna);
    if (!existe) db.exec(`ALTER TABLE velha_duelos ADD COLUMN ${coluna} INTEGER`);
}

// ==============================
// AUXILIARES
// ==============================

function novoCodigo() {
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let codigo = "";
    for (let i = 0; i < 8; i++) codigo += letras[crypto.randomInt(letras.length)];
    return codigo;
}

function lerPorCodigo(codigo) {
    return db.prepare(`SELECT * FROM velha_duelos WHERE codigo = ?`)
        .get(String(codigo || "").toUpperCase());
}

function lerPorId(id) {
    return db.prepare(`SELECT * FROM velha_duelos WHERE id = ?`).get(id);
}

function nomeDoUsuario(usuarioId) {
    if (!usuarioId) return null;
    try {
        const linha = db.prepare(
            `SELECT nome_exibicao FROM usuarios WHERE usuario_id = ?`
        ).get(String(usuarioId));
        return linha?.nome_exibicao || "Jogador";
    } catch {
        return "Jogador";
    }
}

function numeroDoJogador(partida, usuarioId) {
    const id = String(usuarioId);
    if (partida.jogador1_id === id) return 1;
    if (partida.jogador2_id === id) return 2;
    return 0;
}

function lerPartidaAberta(usuarioId) {
    const id = String(usuarioId);
    return db.prepare(`
        SELECT * FROM velha_duelos
        WHERE status IN ('aguardando', 'jogando')
          AND (jogador1_id = ? OR jogador2_id = ?)
        ORDER BY id DESC LIMIT 1
    `).get(id, id);
}

// Jogador 1 é sempre X, jogador 2 é sempre O.
function simbolo(numero) {
    return numero === 1 ? "X" : "O";
}

function verificarTabuleiro(tab) {
    for (const linha of LINHAS) {
        const [a, b, c] = linha;
        if (tab[a] !== "." && tab[a] === tab[b] && tab[a] === tab[c]) {
            return { vencedor: tab[a] === "X" ? 1 : 2, linha };
        }
    }
    if (!tab.includes(".")) return { vencedor: 0, linha: null };
    return null;
}

function finalizar(partidaId, agora, motivo, vencedor) {
    db.prepare(`
        UPDATE velha_duelos
        SET status = 'finalizada', vencedor = ?, motivo_fim = ?,
            finalizado_em = ?, seq = seq + 1
        WHERE id = ?
    `).run(vencedor, motivo, agora, partidaId);
}

function aplicarTempo(partida, agora) {
    if (partida.status === "aguardando" && agora >= partida.expira_em) {
        db.prepare(`
            UPDATE velha_duelos SET status = 'expirada', seq = seq + 1
            WHERE id = ? AND status = 'aguardando'
        `).run(partida.id);
        return lerPorId(partida.id);
    }

    if (partida.status !== "jogando") return partida;

    // Um jogador sumiu (fechou o app) e o outro continua: o outro vence.
    const sumiu1 = agora - (partida.visto1 || 0) > SUMIU_MS;
    const sumiu2 = agora - (partida.visto2 || 0) > SUMIU_MS;

    if (sumiu1 !== sumiu2) {
        finalizar(partida.id, agora, "abandono", sumiu1 ? 2 : 1);
        return lerPorId(partida.id);
    }

    let atual = partida;

    while (atual.status === "jogando" && agora >= atual.vez_inicio + TEMPO_VEZ_MS) {
        const vez = atual.vez;
        const outro = vez === 1 ? 2 : 1;
        const perdas = (vez === 1 ? atual.perdas_vez1 : atual.perdas_vez2) + 1;

        db.prepare(`UPDATE velha_duelos SET perdas_vez${vez} = ? WHERE id = ?`)
            .run(perdas, atual.id);

        if (perdas >= MAX_PERDAS_VEZ) {
            finalizar(atual.id, agora, "abandono", outro);
            return lerPorId(atual.id);
        }

        db.prepare(`
            UPDATE velha_duelos
            SET vez = ?, vez_inicio = ?, ultima_json = ?, seq = seq + 1
            WHERE id = ?
        `).run(
            outro,
            atual.vez_inicio + TEMPO_VEZ_MS,
            JSON.stringify({ tipo: "tempo", jogador: vez }),
            atual.id
        );

        atual = lerPorId(atual.id);
    }

    return atual;
}

function estadoPublico(partida, usuarioId, agora = Date.now()) {
    let vezRestanteMs = null;
    let vezComecaEmMs = 0;

    if (partida.status === "jogando") {
        vezComecaEmMs = Math.max(0, partida.vez_inicio - agora);
        vezRestanteMs = Math.max(0, partida.vez_inicio + TEMPO_VEZ_MS - agora);
    }

    return {
        codigo: partida.codigo,
        status: partida.status,
        eu: numeroDoJogador(partida, usuarioId),
        vez: partida.vez,
        vezRestanteMs,
        vezComecaEmMs,
        tempoVezMs: TEMPO_VEZ_MS,
        tabuleiro: partida.tabuleiro,
        rodada: partida.rodada,
        empates: partida.empates,
        vitoriasParaGanhar: VITORIAS_PARA_GANHAR,
        jogadores: [
            {
                numero: 1,
                simbolo: "X",
                nome: nomeDoUsuario(partida.jogador1_id),
                vitorias: partida.vitorias1,
                perdasVez: partida.perdas_vez1
            },
            {
                numero: 2,
                simbolo: "O",
                nome: nomeDoUsuario(partida.jogador2_id),
                vitorias: partida.vitorias2,
                perdasVez: partida.perdas_vez2
            }
        ],
        ultima: partida.ultima_json ? JSON.parse(partida.ultima_json) : null,
        seq: partida.seq,
        vencedor: partida.vencedor,
        motivoFim: partida.motivo_fim,
        expiraEm: partida.expira_em
    };
}

// ==============================
// CONVIDAR
// ==============================

const criarTransaction = db.transaction((usuarioId, agora) => {
    const id = String(usuarioId);
    const aberta = lerPartidaAberta(id);

    if (aberta && aberta.status === "jogando") {
        const atual = aplicarTempo(aberta, agora);
        if (atual.status === "jogando") {
            return { ok: false, motivo: "em_partida", codigo: atual.codigo };
        }
    }

    const ultimo = db.prepare(`
        SELECT criado_em FROM velha_duelos
        WHERE jogador1_id = ? ORDER BY criado_em DESC LIMIT 1
    `).get(id);

    if (ultimo && agora - ultimo.criado_em < INTERVALO_CONVITE_MS) {
        return {
            ok: false,
            motivo: "aguarde",
            esperarMs: INTERVALO_CONVITE_MS - (agora - ultimo.criado_em)
        };
    }

    db.prepare(`
        UPDATE velha_duelos SET status = 'cancelada', seq = seq + 1
        WHERE jogador1_id = ? AND status = 'aguardando'
    `).run(id);

    let codigo = novoCodigo();
    while (lerPorCodigo(codigo)) codigo = novoCodigo();

    const resultado = db.prepare(`
        INSERT INTO velha_duelos (codigo, jogador1_id, criado_em, expira_em)
        VALUES (?, ?, ?, ?)
    `).run(codigo, id, agora, agora + CONVITE_EXPIRA_MS);

    const partida = lerPorId(resultado.lastInsertRowid);

    return { ok: true, id: partida.id, ...estadoPublico(partida, id, agora) };
});

function criar(usuarioId) {
    return criarTransaction.immediate(String(usuarioId), Date.now());
}

function salvarMensagem(partidaId, chatId, mensagemId) {
    db.prepare(`UPDATE velha_duelos SET msg_chat_id = ?, msg_id = ? WHERE id = ?`)
        .run(String(chatId), Number(mensagemId), partidaId);
}

function cancelarPorFalha(partidaId) {
    db.prepare(`
        UPDATE velha_duelos SET status = 'cancelada', seq = seq + 1
        WHERE id = ? AND status = 'aguardando'
    `).run(partidaId);
}

function cancelar(usuarioId, codigo) {
    const partida = lerPorCodigo(codigo);

    if (!partida || partida.jogador1_id !== String(usuarioId)) {
        return { ok: false, motivo: "partida_inexistente" };
    }

    db.prepare(`
        UPDATE velha_duelos SET status = 'cancelada', seq = seq + 1
        WHERE id = ? AND status = 'aguardando'
    `).run(partida.id);

    return { ok: true };
}

// ==============================
// ENTRAR
// ==============================

const entrarTransaction = db.transaction((usuarioId, codigo, agora) => {
    const id = String(usuarioId);
    let partida = lerPorCodigo(codigo);

    if (!partida) return { ok: false, motivo: "partida_inexistente" };

    marcarVisto(partida, usuarioId, agora);
    partida = aplicarTempo(lerPorId(partida.id), agora);

    if (numeroDoJogador(partida, id)) {
        return { ok: true, ...estadoPublico(partida, id, agora) };
    }

    if (partida.status === "jogando" || partida.status === "finalizada") {
        return { ok: false, motivo: "ja_entraram" };
    }

    if (partida.status !== "aguardando") return { ok: false, motivo: "expirado" };

    const outra = lerPartidaAberta(id);

    if (outra && outra.status === "jogando") {
        const atual = aplicarTempo(outra, agora);
        if (atual.status === "jogando") {
            return { ok: false, motivo: "em_partida", codigo: atual.codigo };
        }
    }

    db.prepare(`
        UPDATE velha_duelos SET status = 'cancelada', seq = seq + 1
        WHERE jogador1_id = ? AND status = 'aguardando'
    `).run(id);

    const comeca = crypto.randomInt(1, 3);

    const resultado = db.prepare(`
        UPDATE velha_duelos
        SET jogador2_id = ?, status = 'jogando', quem_comecou = ?, vez = ?,
            vez_inicio = ?, iniciado_em = ?, visto1 = ?, visto2 = ?, seq = seq + 1
        WHERE id = ? AND status = 'aguardando'
    `).run(id, comeca, comeca, agora + PAUSA_INICIO_MS, agora, agora, agora, partida.id);

    if (resultado.changes === 0) return { ok: false, motivo: "ja_entraram" };

    const atualizada = lerPorId(partida.id);
    return { ok: true, id: atualizada.id, ...estadoPublico(atualizada, id, agora) };
});

function entrar(usuarioId, codigo) {
    return entrarTransaction.immediate(
        String(usuarioId),
        String(codigo || "").toUpperCase(),
        Date.now()
    );
}

// Guarda que o jogador deu sinal agora.
function marcarVisto(partida, usuarioId, agora) {
    const numero = numeroDoJogador(partida, usuarioId);
    if (!numero) return;
    db.prepare(`UPDATE velha_duelos SET visto${numero} = ? WHERE id = ?`)
        .run(agora, partida.id);
}

// ==============================
// DESISTIR (tocou em VOLTAR ou fechou o app)
// ==============================

const desistirTransaction = db.transaction((usuarioId, codigo, agora) => {
    const partida = lerPorCodigo(codigo);
    if (!partida) return { ok: false, motivo: "partida_inexistente" };

    const eu = numeroDoJogador(partida, usuarioId);
    if (!eu) return { ok: false, motivo: "nao_participa" };

    if (partida.status === "aguardando" && eu === 1) {
        db.prepare(`
            UPDATE velha_duelos SET status = 'cancelada', seq = seq + 1
            WHERE id = ? AND status = 'aguardando'
        `).run(partida.id);
    } else if (partida.status === "jogando") {
        finalizar(partida.id, agora, "abandono", eu === 1 ? 2 : 1);
    }

    return { ok: true };
});

function desistir(usuarioId, codigo) {
    return desistirTransaction.immediate(
        String(usuarioId),
        String(codigo || "").toUpperCase(),
        Date.now()
    );
}

// ==============================
// ESTADO
// ==============================

const estadoTransaction = db.transaction((usuarioId, codigo, agora) => {
    let partida = lerPorCodigo(codigo);
    if (!partida) return { ok: false, motivo: "partida_inexistente" };

    marcarVisto(partida, usuarioId, agora);
    partida = aplicarTempo(lerPorId(partida.id), agora);

    if (!numeroDoJogador(partida, usuarioId)) return { ok: false, motivo: "nao_participa" };

    return { ok: true, ...estadoPublico(partida, usuarioId, agora) };
});

function estado(usuarioId, codigo) {
    return estadoTransaction.immediate(
        String(usuarioId),
        String(codigo || "").toUpperCase(),
        Date.now()
    );
}

// ==============================
// JOGADA
// ==============================

const jogarTransaction = db.transaction((usuarioId, codigo, casa, agora) => {
    let partida = lerPorCodigo(codigo);
    if (!partida) return { ok: false, motivo: "partida_inexistente" };

    marcarVisto(partida, usuarioId, agora);
    partida = aplicarTempo(lerPorId(partida.id), agora);

    const eu = numeroDoJogador(partida, usuarioId);

    if (!eu) return { ok: false, motivo: "nao_participa" };
    if (partida.status !== "jogando") return { ok: false, motivo: "partida_encerrada" };
    if (partida.vez !== eu) return { ok: false, motivo: "nao_e_sua_vez" };
    if (agora < partida.vez_inicio) return { ok: false, motivo: "aguarde_vez" };

    const indice = Math.trunc(Number(casa));

    if (!Number.isInteger(indice) || indice < 0 || indice > 8) {
        return { ok: false, motivo: "casa_invalida" };
    }

    const tab = partida.tabuleiro.split("");

    if (tab[indice] !== ".") return { ok: false, motivo: "casa_ocupada" };

    tab[indice] = simbolo(eu);
    const tabuleiro = tab.join("");
    const outro = eu === 1 ? 2 : 1;
    const fim = verificarTabuleiro(tabuleiro);

    // Rodada continua: a vez passa
    if (!fim) {
        db.prepare(`
            UPDATE velha_duelos
            SET tabuleiro = ?, vez = ?, vez_inicio = ?, perdas_vez${eu} = 0,
                ultima_json = ?, seq = seq + 1
            WHERE id = ?
        `).run(
            tabuleiro, outro, agora,
            JSON.stringify({ tipo: "jogada", jogador: eu, casa: indice }),
            partida.id
        );

        return { ok: true, ...estadoPublico(lerPorId(partida.id), usuarioId, agora) };
    }

    // Fim da rodada
    const v1 = partida.vitorias1 + (fim.vencedor === 1 ? 1 : 0);
    const v2 = partida.vitorias2 + (fim.vencedor === 2 ? 1 : 0);
    const empates = partida.empates + (fim.vencedor === 0 ? 1 : 0);

    const ultima = {
        tipo: "rodada",
        rodada: partida.rodada,
        vencedor: fim.vencedor,
        linha: fim.linha,
        tabuleiro
    };

    let vencedorPartida = null;

    if (v1 >= VITORIAS_PARA_GANHAR) vencedorPartida = 1;
    else if (v2 >= VITORIAS_PARA_GANHAR) vencedorPartida = 2;
    else if (partida.rodada >= MAX_RODADAS) {
        vencedorPartida = v1 > v2 ? 1 : v2 > v1 ? 2 : 0;
    }

    // Próxima rodada: quem começa alterna
    const proximoComeca = partida.quem_comecou === 1 ? 2 : 1;

    db.prepare(`
        UPDATE velha_duelos
        SET tabuleiro = ?, vitorias1 = ?, vitorias2 = ?, empates = ?,
            rodada = ?, quem_comecou = ?, vez = ?, vez_inicio = ?,
            perdas_vez${eu} = 0, ultima_json = ?, seq = seq + 1
        WHERE id = ?
    `).run(
        vencedorPartida === null ? "........." : tabuleiro,
        v1, v2, empates,
        vencedorPartida === null ? partida.rodada + 1 : partida.rodada,
        vencedorPartida === null ? proximoComeca : partida.quem_comecou,
        vencedorPartida === null ? proximoComeca : partida.vez,
        agora + PAUSA_RODADA_MS,
        JSON.stringify(ultima),
        partida.id
    );

    if (vencedorPartida !== null) {
        finalizar(partida.id, agora, "rodadas", vencedorPartida);
    }

    return { ok: true, ...estadoPublico(lerPorId(partida.id), usuarioId, agora) };
});

function jogar(usuarioId, codigo, casa) {
    return jogarTransaction.immediate(
        String(usuarioId),
        String(codigo || "").toUpperCase(),
        casa,
        Date.now()
    );
}

// ==============================
// VARREDURA
// ==============================

const varrerTransaction = db.transaction((agora) => {
    const paradas = db.prepare(`
        SELECT * FROM velha_duelos
        WHERE status = 'jogando' OR (status = 'aguardando' AND expira_em <= ?)
    `).all(agora);

    for (const partida of paradas) aplicarTempo(partida, agora);

    return db.prepare(`
        SELECT id, msg_chat_id, msg_id FROM velha_duelos
        WHERE status <> 'aguardando' AND msg_id IS NOT NULL
          AND msg_apagada = 0 AND msg_tentativas < 5
    `).all();
});

function varrer() {
    return varrerTransaction.immediate(Date.now());
}

function marcarMensagemApagada(partidaId, deuCerto) {
    if (deuCerto) {
        db.prepare(`UPDATE velha_duelos SET msg_apagada = 1 WHERE id = ?`).run(partidaId);
    } else {
        db.prepare(`
            UPDATE velha_duelos SET msg_tentativas = msg_tentativas + 1 WHERE id = ?
        `).run(partidaId);
    }
}

// ==============================
// RANKING
// ==============================

function listarRanking(limite = 50) {
    const limiteSeguro = Math.max(1, Math.min(100, Math.trunc(Number(limite) || 50)));

    const linhas = db.prepare(`
        WITH lados AS (
            SELECT jogador1_id AS usuario_id,
                   CASE WHEN vencedor = 1 THEN 1 ELSE 0 END AS vitoria,
                   CASE WHEN vencedor = 0 THEN 1 ELSE 0 END AS empate,
                   CASE WHEN vencedor = 2 THEN 1 ELSE 0 END AS derrota,
                   vitorias1 AS rodadas
            FROM velha_duelos WHERE status = 'finalizada'
            UNION ALL
            SELECT jogador2_id,
                   CASE WHEN vencedor = 2 THEN 1 ELSE 0 END,
                   CASE WHEN vencedor = 0 THEN 1 ELSE 0 END,
                   CASE WHEN vencedor = 1 THEN 1 ELSE 0 END,
                   vitorias2
            FROM velha_duelos WHERE status = 'finalizada'
        )
        SELECT usuario_id,
               SUM(vitoria) AS vitorias, SUM(empate) AS empates,
               SUM(derrota) AS derrotas, SUM(rodadas) AS rodadas
        FROM lados
        GROUP BY usuario_id
        ORDER BY vitorias DESC, rodadas DESC, usuario_id ASC
        LIMIT ?
    `).all(limiteSeguro);

    return linhas.map((linha, i) => ({
        posicao: i + 1,
        usuarioId: String(linha.usuario_id),
        nome: nomeDoUsuario(linha.usuario_id),
        vitorias: Number(linha.vitorias),
        empates: Number(linha.empates),
        derrotas: Number(linha.derrotas),
        rodadas: Number(linha.rodadas)
    }));
}

module.exports = {
    CONVITE_EXPIRA_MS,
    criar,
    salvarMensagem,
    cancelarPorFalha,
    cancelar,
    entrar,
    estado,
    jogar,
    desistir,
    varrer,
    marcarMensagemApagada,
    listarRanking
};
