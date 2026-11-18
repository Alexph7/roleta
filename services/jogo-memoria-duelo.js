// Duelo do Jogo da Memória (2 jogadores).
// O servidor é o juiz: guarda as cartas, de quem é a vez
// e os pontos. Os celulares só perguntam o estado.

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

const TOTAL_CARTAS = 48;
const TOTAL_PARES = TOTAL_CARTAS / 2;

const CONVITE_EXPIRA_MS = 3 * 60 * 1000;   // convite some em 3 min
const INTERVALO_CONVITE_MS = 60 * 1000;    // 1 convite por minuto
const TEMPO_VEZ_MS = 30 * 1000;            // 20 s para jogar
const MAX_PERDAS_VEZ = 3;                  // 3 vezes seguidas = abandono
const PAUSA_ERRO_MS = 1500;                // cartas erradas ficam à mostra
const PAUSA_INICIO_MS = 3000;              // tempo para os dois carregarem
const SUMIU_MS = 30 * 1000;                // sem sinal por 30 s = saiu da partida

const EMOJIS = [
    0x1F34E, 0x1F349, 0x1F680, 0x1F31F, 0x1F381, 0x1F984,
    0x1F43C, 0x1F355, 0x26BD, 0x1F308, 0x1F438, 0x1F431,
    0x1F436, 0x1F354, 0x1F388, 0x1F3C6, 0x1F6B2, 0x1F3B8,
    0x1F353, 0x1F419, 0x1F33B, 0x1F369, 0x1F98A, 0x1F3AE
].map(codigo => String.fromCodePoint(codigo));

// ==============================
// TABELA
// ==============================

db.exec(`
    CREATE TABLE IF NOT EXISTS memoria_duelos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'aguardando',
        jogador1_id TEXT NOT NULL,
        jogador2_id TEXT,
        cartas_json TEXT NOT NULL,
        pares_json TEXT NOT NULL DEFAULT '[]',
        selecionada_indice INTEGER,
        vez INTEGER,
        vez_inicio INTEGER,
        pontos1 INTEGER NOT NULL DEFAULT 0,
        pontos2 INTEGER NOT NULL DEFAULT 0,
        jogadas1 INTEGER NOT NULL DEFAULT 0,
        jogadas2 INTEGER NOT NULL DEFAULT 0,
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

    CREATE INDEX IF NOT EXISTS idx_memoria_duelos_status
        ON memoria_duelos (status);

    CREATE INDEX IF NOT EXISTS idx_memoria_duelos_j1
        ON memoria_duelos (jogador1_id, criado_em);

    CREATE INDEX IF NOT EXISTS idx_memoria_duelos_j2
        ON memoria_duelos (jogador2_id);
`);

// Colunas novas: última vez que cada jogador deu sinal
for (const coluna of ["visto1", "visto2"]) {
    const existe = db.prepare(`PRAGMA table_info(memoria_duelos)`).all()
        .some(c => c.name === coluna);
    if (!existe) db.exec(`ALTER TABLE memoria_duelos ADD COLUMN ${coluna} INTEGER`);
}

// ==============================
// AUXILIARES
// ==============================

function embaralhar(lista) {
    const resultado = [...lista];

    for (let i = resultado.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
    }

    return resultado;
}

function criarCartas() {
    const pares = EMOJIS.map((emoji, par) => ({ par, emoji }));
    return embaralhar(pares.flatMap(item => [item, item]));
}

function novoCodigo() {
    const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let codigo = "";

    for (let i = 0; i < 8; i++) {
        codigo += letras[crypto.randomInt(letras.length)];
    }

    return codigo;
}

function lerPorCodigo(codigo) {
    return db.prepare(`
        SELECT * FROM memoria_duelos WHERE codigo = ?
    `).get(String(codigo || "").toUpperCase());
}

function lerPorId(id) {
    return db.prepare(`
        SELECT * FROM memoria_duelos WHERE id = ?
    `).get(id);
}

function nomeDoUsuario(usuarioId) {
    if (!usuarioId) return null;

    try {
        const linha = db.prepare(`
            SELECT nome_exibicao FROM usuarios WHERE usuario_id = ?
        `).get(String(usuarioId));

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

// Partida aberta (aguardando ou jogando) em que o usuário está.
function lerPartidaAberta(usuarioId) {
    const id = String(usuarioId);

    return db.prepare(`
        SELECT * FROM memoria_duelos
        WHERE status IN ('aguardando', 'jogando')
          AND (jogador1_id = ? OR jogador2_id = ?)
        ORDER BY id DESC
        LIMIT 1
    `).get(id, id);
}

function finalizar(partida, agora, motivo, vencedorForcado) {
    let vencedor = vencedorForcado;

    if (vencedor === undefined) {
        if (partida.pontos1 > partida.pontos2) vencedor = 1;
        else if (partida.pontos2 > partida.pontos1) vencedor = 2;
        else vencedor = 0; // empate
    }

    db.prepare(`
        UPDATE memoria_duelos
        SET status = 'finalizada',
            vencedor = ?,
            motivo_fim = ?,
            selecionada_indice = NULL,
            finalizado_em = ?,
            seq = seq + 1
        WHERE id = ?
    `).run(vencedor, motivo, agora, partida.id);
}

// Passa a vez de quem deixou o tempo acabar.
// Quem perde a vez 3 vezes seguidas perde a partida.
function aplicarTempo(partida, agora) {
    if (partida.status === "aguardando" && agora >= partida.expira_em) {
        db.prepare(`
            UPDATE memoria_duelos
            SET status = 'expirada', seq = seq + 1
            WHERE id = ? AND status = 'aguardando'
        `).run(partida.id);

        return lerPorId(partida.id);
    }

    if (partida.status !== "jogando") return partida;

    // Um jogador sumiu (fechou o app) e o outro continua: o outro vence.
    const sumiu1 = agora - (partida.visto1 || 0) > SUMIU_MS;
    const sumiu2 = agora - (partida.visto2 || 0) > SUMIU_MS;

    if (sumiu1 !== sumiu2) {
        finalizar(partida, agora, "abandono", sumiu1 ? 2 : 1);
        return lerPorId(partida.id);
    }

    let atual = partida;

    while (
        atual.status === "jogando" &&
        agora >= atual.vez_inicio + TEMPO_VEZ_MS
    ) {
        const vez = atual.vez;
        const outro = vez === 1 ? 2 : 1;
        const perdas = (vez === 1 ? atual.perdas_vez1 : atual.perdas_vez2) + 1;

        if (perdas >= MAX_PERDAS_VEZ) {
            db.prepare(`
                UPDATE memoria_duelos
                SET perdas_vez${vez} = ?
                WHERE id = ?
            `).run(perdas, atual.id);

            finalizar(atual, agora, "abandono", outro);
            return lerPorId(atual.id);
        }

        db.prepare(`
            UPDATE memoria_duelos
            SET perdas_vez${vez} = ?,
                vez = ?,
                vez_inicio = ?,
                selecionada_indice = NULL,
                ultima_json = ?,
                seq = seq + 1
            WHERE id = ?
        `).run(
            perdas,
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
    const cartas = JSON.parse(partida.cartas_json);
    const pares = JSON.parse(partida.pares_json || "[]");

    const donoDoPar = new Map(pares.map(p => [p.par, p.jogador]));

    const encontradas = [];

    cartas.forEach((carta, indice) => {
        if (donoDoPar.has(carta.par)) {
            encontradas.push({
                indice,
                emoji: carta.emoji,
                jogador: donoDoPar.get(carta.par)
            });
        }
    });

    const selecionada =
        partida.selecionada_indice === null ||
        partida.selecionada_indice === undefined
            ? null
            : {
                indice: partida.selecionada_indice,
                emoji: cartas[partida.selecionada_indice].emoji
            };

    let vezRestanteMs = null;
    let vezComecaEmMs = 0;

    if (partida.status === "jogando") {
        vezComecaEmMs = Math.max(0, partida.vez_inicio - agora);
        vezRestanteMs = Math.max(
            0,
            partida.vez_inicio + TEMPO_VEZ_MS - agora
        );
    }

    return {
        codigo: partida.codigo,
        status: partida.status,
        eu: numeroDoJogador(partida, usuarioId),
        vez: partida.vez,
        vezRestanteMs,
        vezComecaEmMs,
        tempoVezMs: TEMPO_VEZ_MS,
        totalCartas: TOTAL_CARTAS,
        totalPares: TOTAL_PARES,
        jogadores: [
            {
                numero: 1,
                nome: nomeDoUsuario(partida.jogador1_id),
                pontos: partida.pontos1,
                jogadas: partida.jogadas1,
                perdasVez: partida.perdas_vez1
            },
            {
                numero: 2,
                nome: nomeDoUsuario(partida.jogador2_id),
                pontos: partida.pontos2,
                jogadas: partida.jogadas2,
                perdasVez: partida.perdas_vez2
            }
        ],
        encontradas,
        selecionada,
        ultima: partida.ultima_json ? JSON.parse(partida.ultima_json) : null,
        seq: partida.seq,
        vencedor: partida.vencedor,
        motivoFim: partida.motivo_fim,
        expiraEm: partida.expira_em
    };
}

// ==============================
// CONVIDAR (CRIAR SALA)
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
        SELECT criado_em FROM memoria_duelos
        WHERE jogador1_id = ?
        ORDER BY criado_em DESC
        LIMIT 1
    `).get(id);

    if (ultimo && agora - ultimo.criado_em < INTERVALO_CONVITE_MS) {
        return {
            ok: false,
            motivo: "aguarde",
            esperarMs: INTERVALO_CONVITE_MS - (agora - ultimo.criado_em)
        };
    }

    // Convite antigo ainda esperando: é cancelado
    // (a mensagem dele é apagada pela varredura).
    db.prepare(`
        UPDATE memoria_duelos
        SET status = 'cancelada', seq = seq + 1
        WHERE jogador1_id = ? AND status = 'aguardando'
    `).run(id);

    let codigo = novoCodigo();
    while (lerPorCodigo(codigo)) codigo = novoCodigo();

    const resultado = db.prepare(`
        INSERT INTO memoria_duelos (
            codigo, jogador1_id, cartas_json, criado_em, expira_em
        ) VALUES (?, ?, ?, ?, ?)
    `).run(
        codigo,
        id,
        JSON.stringify(criarCartas()),
        agora,
        agora + CONVITE_EXPIRA_MS
    );

    const partida = lerPorId(resultado.lastInsertRowid);

    return {
        ok: true,
        id: partida.id,
        ...estadoPublico(partida, id, agora)
    };
});

function criar(usuarioId) {
    return criarTransaction.immediate(String(usuarioId), Date.now());
}

// Guarda qual mensagem do chat é o convite (para apagar depois).
function salvarMensagem(partidaId, chatId, mensagemId) {
    db.prepare(`
        UPDATE memoria_duelos
        SET msg_chat_id = ?, msg_id = ?
        WHERE id = ?
    `).run(String(chatId), Number(mensagemId), partidaId);
}

// Se o convite não chegou no chat, a sala é cancelada.
function cancelarPorFalha(partidaId) {
    db.prepare(`
        UPDATE memoria_duelos
        SET status = 'cancelada', seq = seq + 1
        WHERE id = ? AND status = 'aguardando'
    `).run(partidaId);
}

// Quem convidou desistiu antes de alguém entrar.
function cancelar(usuarioId, codigo) {
    const partida = lerPorCodigo(codigo);

    if (!partida || partida.jogador1_id !== String(usuarioId)) {
        return { ok: false, motivo: "partida_inexistente" };
    }

    db.prepare(`
        UPDATE memoria_duelos
        SET status = 'cancelada', seq = seq + 1
        WHERE id = ? AND status = 'aguardando'
    `).run(partida.id);

    return { ok: true };
}

// ==============================
// ENTRAR (ACEITAR O CONVITE)
// ==============================

const entrarTransaction = db.transaction((usuarioId, codigo, agora) => {
    const id = String(usuarioId);
    let partida = lerPorCodigo(codigo);

    if (!partida) {
        return { ok: false, motivo: "partida_inexistente" };
    }

    marcarVisto(partida, usuarioId, agora);
    partida = aplicarTempo(lerPorId(partida.id), agora);

    // Já é um dos dois jogadores: só volta para a partida.
    if (numeroDoJogador(partida, id)) {
        return { ok: true, ...estadoPublico(partida, id, agora) };
    }

    if (partida.status === "jogando" || partida.status === "finalizada") {
        return { ok: false, motivo: "ja_entraram" };
    }

    if (partida.status !== "aguardando") {
        return { ok: false, motivo: "expirado" };
    }

    const outra = lerPartidaAberta(id);

    if (outra && outra.status === "jogando") {
        const atual = aplicarTempo(outra, agora);

        if (atual.status === "jogando") {
            return { ok: false, motivo: "em_partida", codigo: atual.codigo };
        }
    }

    // Quem estava esperando o próprio convite e entrou
    // no de outra pessoa: o convite dele é cancelado.
    db.prepare(`
        UPDATE memoria_duelos
        SET status = 'cancelada', seq = seq + 1
        WHERE jogador1_id = ? AND status = 'aguardando'
    `).run(id);

    // Quem começa é sorteado.
    const vez = crypto.randomInt(1, 3);

    const resultado = db.prepare(`
        UPDATE memoria_duelos
        SET jogador2_id = ?,
            status = 'jogando',
            vez = ?,
            vez_inicio = ?,
            iniciado_em = ?,
            visto1 = ?,
            visto2 = ?,
            seq = seq + 1
        WHERE id = ? AND status = 'aguardando'
    `).run(id, vez, agora + PAUSA_INICIO_MS, agora, agora, agora, partida.id);

    if (resultado.changes === 0) {
        return { ok: false, motivo: "ja_entraram" };
    }

    const atualizada = lerPorId(partida.id);

    return {
        ok: true,
        id: atualizada.id,
        ...estadoPublico(atualizada, id, agora)
    };
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
    db.prepare(`UPDATE memoria_duelos SET visto${numero} = ? WHERE id = ?`)
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
            UPDATE memoria_duelos SET status = 'cancelada', seq = seq + 1
            WHERE id = ? AND status = 'aguardando'
        `).run(partida.id);
    } else if (partida.status === "jogando") {
        finalizar(partida, agora, "abandono", eu === 1 ? 2 : 1);
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
// ESTADO (O CELULAR PERGUNTA A CADA 1,5 s)
// ==============================

const estadoTransaction = db.transaction((usuarioId, codigo, agora) => {
    let partida = lerPorCodigo(codigo);

    if (!partida) {
        return { ok: false, motivo: "partida_inexistente" };
    }

    marcarVisto(partida, usuarioId, agora);
    partida = aplicarTempo(lerPorId(partida.id), agora);

    if (!numeroDoJogador(partida, usuarioId)) {
        return { ok: false, motivo: "nao_participa" };
    }

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

const jogarTransaction = db.transaction((usuarioId, codigo, indice, agora) => {
    let partida = lerPorCodigo(codigo);

    if (!partida) {
        return { ok: false, motivo: "partida_inexistente" };
    }

    marcarVisto(partida, usuarioId, agora);
    partida = aplicarTempo(lerPorId(partida.id), agora);

    const eu = numeroDoJogador(partida, usuarioId);

    if (!eu) return { ok: false, motivo: "nao_participa" };
    if (partida.status !== "jogando") return { ok: false, motivo: "partida_encerrada" };
    if (partida.vez !== eu) return { ok: false, motivo: "nao_e_sua_vez" };
    if (agora < partida.vez_inicio) return { ok: false, motivo: "aguarde_vez" };

    const indiceSeguro = Math.trunc(Number(indice));
    const cartas = JSON.parse(partida.cartas_json);

    if (
        !Number.isInteger(indiceSeguro) ||
        indiceSeguro < 0 ||
        indiceSeguro >= cartas.length
    ) {
        return { ok: false, motivo: "indice_invalido" };
    }

    const pares = JSON.parse(partida.pares_json || "[]");

    if (pares.some(p => p.par === cartas[indiceSeguro].par)) {
        return { ok: false, motivo: "carta_ja_encontrada" };
    }

    // ---------- PRIMEIRA CARTA ----------

    if (partida.selecionada_indice === null) {
        db.prepare(`
            UPDATE memoria_duelos
            SET selecionada_indice = ?,
                perdas_vez${eu} = 0,
                seq = seq + 1
            WHERE id = ?
        `).run(indiceSeguro, partida.id);

        const atualizada = lerPorId(partida.id);
        return { ok: true, ...estadoPublico(atualizada, usuarioId, agora) };
    }

    if (partida.selecionada_indice === indiceSeguro) {
        return { ok: false, motivo: "mesma_carta" };
    }

    // ---------- SEGUNDA CARTA ----------

    const primeiroIndice = partida.selecionada_indice;
    const primeiro = cartas[primeiroIndice];
    const segundo = cartas[indiceSeguro];
    const combinou = primeiro.par === segundo.par;

    const ultima = {
        tipo: "par",
        jogador: eu,
        combinou,
        cartas: [
            { indice: primeiroIndice, emoji: primeiro.emoji },
            { indice: indiceSeguro, emoji: segundo.emoji }
        ]
    };

    if (combinou) {
        // Acertou: ganha 1 ponto e continua jogando.
        const novosPares = [...pares, { par: primeiro.par, jogador: eu }];

        db.prepare(`
            UPDATE memoria_duelos
            SET pares_json = ?,
                selecionada_indice = NULL,
                pontos${eu} = pontos${eu} + 1,
                jogadas${eu} = jogadas${eu} + 1,
                vez_inicio = ?,
                ultima_json = ?,
                seq = seq + 1
            WHERE id = ?
        `).run(
            JSON.stringify(novosPares),
            agora,
            JSON.stringify(ultima),
            partida.id
        );

        let atualizada = lerPorId(partida.id);

        if (novosPares.length === TOTAL_PARES) {
            finalizar(atualizada, agora, "pares");
            atualizada = lerPorId(partida.id);
        }

        return { ok: true, ...estadoPublico(atualizada, usuarioId, agora) };
    }

    // Errou: a vez passa para o outro.
    const outro = eu === 1 ? 2 : 1;

    db.prepare(`
        UPDATE memoria_duelos
        SET selecionada_indice = NULL,
            jogadas${eu} = jogadas${eu} + 1,
            vez = ?,
            vez_inicio = ?,
            ultima_json = ?,
            seq = seq + 1
        WHERE id = ?
    `).run(
        outro,
        agora + PAUSA_ERRO_MS,
        JSON.stringify(ultima),
        partida.id
    );

    const atualizada = lerPorId(partida.id);
    return { ok: true, ...estadoPublico(atualizada, usuarioId, agora) };
});

function jogar(usuarioId, codigo, indice) {
    return jogarTransaction.immediate(
        String(usuarioId),
        String(codigo || "").toUpperCase(),
        indice,
        Date.now()
    );
}

// ==============================
// VARREDURA (A CADA 10 s)
// ==============================

// Fecha partidas paradas (os dois saíram) e devolve
// os convites que precisam ser apagados do chat.
const varrerTransaction = db.transaction((agora) => {
    const paradas = db.prepare(`
        SELECT * FROM memoria_duelos
        WHERE status = 'jogando'
           OR (status = 'aguardando' AND expira_em <= ?)
    `).all(agora);

    for (const partida of paradas) {
        aplicarTempo(partida, agora);
    }

    return db.prepare(`
        SELECT id, msg_chat_id, msg_id
        FROM memoria_duelos
        WHERE status <> 'aguardando'
          AND msg_id IS NOT NULL
          AND msg_apagada = 0
          AND msg_tentativas < 5
    `).all();
});

function varrer() {
    return varrerTransaction.immediate(Date.now());
}

function marcarMensagemApagada(partidaId, deuCerto) {
    if (deuCerto) {
        db.prepare(`
            UPDATE memoria_duelos SET msg_apagada = 1 WHERE id = ?
        `).run(partidaId);
    } else {
        db.prepare(`
            UPDATE memoria_duelos
            SET msg_tentativas = msg_tentativas + 1
            WHERE id = ?
        `).run(partidaId);
    }
}

// ==============================
// RANKING DE DUELOS
// ==============================

function listarRanking(limite = 50) {
    const limiteSeguro = Math.max(
        1,
        Math.min(100, Math.trunc(Number(limite) || 50))
    );

    const linhas = db.prepare(`
        WITH lados AS (
            SELECT jogador1_id AS usuario_id,
                   CASE WHEN vencedor = 1 THEN 1 ELSE 0 END AS vitoria,
                   CASE WHEN vencedor = 0 THEN 1 ELSE 0 END AS empate,
                   CASE WHEN vencedor = 2 THEN 1 ELSE 0 END AS derrota,
                   pontos1 AS pares
            FROM memoria_duelos
            WHERE status = 'finalizada'
            UNION ALL
            SELECT jogador2_id,
                   CASE WHEN vencedor = 2 THEN 1 ELSE 0 END,
                   CASE WHEN vencedor = 0 THEN 1 ELSE 0 END,
                   CASE WHEN vencedor = 1 THEN 1 ELSE 0 END,
                   pontos2
            FROM memoria_duelos
            WHERE status = 'finalizada'
        )
        SELECT usuario_id,
               SUM(vitoria) AS vitorias,
               SUM(empate) AS empates,
               SUM(derrota) AS derrotas,
               SUM(pares) AS pares
        FROM lados
        GROUP BY usuario_id
        ORDER BY vitorias DESC, pares DESC, usuario_id ASC
        LIMIT ?
    `).all(limiteSeguro);

    return linhas.map((linha, i) => ({
        posicao: i + 1,
        usuarioId: String(linha.usuario_id),
        nome: nomeDoUsuario(linha.usuario_id),
        vitorias: Number(linha.vitorias),
        empates: Number(linha.empates),
        derrotas: Number(linha.derrotas),
        pares: Number(linha.pares)
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
