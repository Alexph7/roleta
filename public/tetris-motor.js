// Motor do jogo de blocos.
// O MESMO arquivo roda no celular (para jogar) e no servidor (para conferir
// a partida). Por isso nao pode usar nada do navegador nem do Node aqui dentro.
(function (raiz, fabrica) {
    if (typeof module === "object" && module.exports) {
        module.exports = fabrica();
    } else {
        raiz.TetrisMotor = fabrica();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const LARGURA = 25;
    const ALTURA = 22;
    const PONTOS_POR_LINHA = 10;

    // Limite de acoes por partida (mantem o envio pequeno e a partida finita).
    const LIMITE_EVENTOS = 12000;

    // L = esquerda, R = direita, C = girar, D = descer 1,
    // H = queda direta, T = descida automatica (tempo)
    const ACOES = "LRCDHT";
    const ALFABETO =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    // I, O, T, S, Z, J, L
    const FORMAS = [
        { n: 4, c: [[0, 1], [1, 1], [2, 1], [3, 1]] },
        { n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]] },
        { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]] },
        { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]] },
        { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },
        { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]] },
        { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]] }
    ];

    const ROTACOES = FORMAS.map(forma => {
        const lista = [forma.c];

        for (let i = 1; i < 4; i++) {
            lista.push(
                lista[i - 1].map(([x, y]) => [forma.n - 1 - y, x])
            );
        }

        return lista;
    });

    // Gerador de numeros "aleatorios" repetivel (mulberry32).
    function criarRng(semente) {
        let a = semente | 0;

        return function () {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Sorteio em "sacolas" de 7 pecas, para nao faltar nenhuma por muito tempo.
    function sortear(e) {
        if (!e.sacola.length) {
            const s = [0, 1, 2, 3, 4, 5, 6];

            for (let i = 6; i > 0; i--) {
                const j = Math.floor(e.rng() * (i + 1));
                [s[i], s[j]] = [s[j], s[i]];
            }

            e.sacola = s;
        }

        return e.sacola.pop();
    }

    function celulasPeca(tipo, rot) {
        return ROTACOES[tipo][rot || 0];
    }

    function celulas(peca) {
        return ROTACOES[peca.tipo][peca.rot].map(
            ([cx, cy]) => [peca.x + cx, peca.y + cy]
        );
    }

    function colide(e, peca) {
        for (const [x, y] of celulas(peca)) {
            if (x < 0 || x >= LARGURA || y >= ALTURA) return true;
            if (y >= 0 && e.tabuleiro[y][x]) return true;
        }

        return false;
    }

    function novaPeca(e) {
        const tipo = e.fila.shift();
        e.fila.push(sortear(e));

        const n = FORMAS[tipo].n;

        e.peca = {
            tipo,
            rot: 0,
            x: Math.floor((LARGURA - n) / 2),
            y: 0
        };

        if (colide(e, e.peca)) {
            e.fim = true;
        }
    }

    function criarJogo(semente) {
        const e = {
            rng: criarRng(semente),
            sacola: [],
            fila: [],
            tabuleiro: Array.from(
                { length: ALTURA },
                () => new Array(LARGURA).fill(0)
            ),
            peca: null,
            linhas: 0,
            pontos: 0,
            pecas: 0,
            eventos: 0,
            ticks: 0,
            fim: false
        };

        e.fila.push(sortear(e));
        e.fila.push(sortear(e));
        novaPeca(e);

        return e;
    }

    function travar(e) {
        for (const [x, y] of celulas(e.peca)) {
            if (y >= 0) e.tabuleiro[y][x] = e.peca.tipo + 1;
        }

        e.pecas++;

        const restantes = e.tabuleiro.filter(
            linha => linha.some(v => v === 0)
        );
        const limpas = ALTURA - restantes.length;

        if (limpas > 0) {
            while (restantes.length < ALTURA) {
                restantes.unshift(new Array(LARGURA).fill(0));
            }

            e.tabuleiro = restantes;
            e.linhas += limpas;
            e.pontos += limpas * PONTOS_POR_LINHA;
        }

        novaPeca(e);
    }

    function mover(e, dx) {
        const t = { ...e.peca, x: e.peca.x + dx };
        if (!colide(e, t)) e.peca = t;
    }

    function girar(e) {
        const rot = (e.peca.rot + 1) % 4;

        for (const dx of [0, -1, 1, -2, 2]) {
            const t = { tipo: e.peca.tipo, rot, x: e.peca.x + dx, y: e.peca.y };

            if (!colide(e, t)) {
                e.peca = t;
                return;
            }
        }
    }

    function descer(e) {
        const t = { ...e.peca, y: e.peca.y + 1 };

        if (!colide(e, t)) {
            e.peca = t;
        } else {
            travar(e);
        }
    }

    function quedaDireta(e) {
        while (!colide(e, { ...e.peca, y: e.peca.y + 1 })) {
            e.peca.y++;
        }

        travar(e);
    }

    // Aplica UMA acao. Devolve false se o jogo ja tinha acabado.
    function aplicar(e, acao) {
        if (e.fim) return false;

        e.eventos++;

        if (acao === "L") mover(e, -1);
        else if (acao === "R") mover(e, 1);
        else if (acao === "C") girar(e);
        else if (acao === "D") descer(e);
        else if (acao === "H") quedaDireta(e);
        else if (acao === "T") {
            e.ticks++;
            descer(e);
        }

        if (!e.fim && e.eventos >= LIMITE_EVENTOS) {
            e.fim = true;
        }

        return true;
    }

    // ---- envio compacto: 2 acoes por letra ----

    function empacotar(texto) {
        let saida = "";

        for (let i = 0; i < texto.length; i += 2) {
            const a = ACOES.indexOf(texto[i]);

            if (i + 1 < texto.length) {
                saida += ALFABETO[a * 6 + ACOES.indexOf(texto[i + 1])];
            } else {
                saida += ALFABETO[36 + a];
            }
        }

        return saida;
    }

    function desempacotar(pacote) {
        if (typeof pacote !== "string") return null;

        let saida = "";

        for (let i = 0; i < pacote.length; i++) {
            const v = ALFABETO.indexOf(pacote[i]);

            if (v < 0 || v > 41) return null;

            if (v < 36) {
                saida += ACOES[Math.floor(v / 6)] + ACOES[v % 6];
            } else {
                // acao sozinha so e permitida no fim
                if (i !== pacote.length - 1) return null;
                saida += ACOES[v - 36];
            }
        }

        return saida;
    }

    // Refaz a partida inteira (usado pelo servidor para conferir).
    function reproduzir(semente, pacote) {
        const acoes = desempacotar(pacote);

        if (acoes === null || acoes.length === 0) {
            return { ok: false, motivo: "pacote_invalido" };
        }

        const e = criarJogo(semente);

        for (let i = 0; i < acoes.length; i++) {
            if (!aplicar(e, acoes[i])) {
                return { ok: false, motivo: "acoes_depois_do_fim" };
            }
        }

        if (!e.fim) {
            return { ok: false, motivo: "jogo_nao_terminou" };
        }

        return {
            ok: true,
            pontos: e.pontos,
            linhas: e.linhas,
            pecas: e.pecas,
            eventos: e.eventos,
            ticks: e.ticks
        };
    }

    return {
        LARGURA,
        ALTURA,
        PONTOS_POR_LINHA,
        LIMITE_EVENTOS,
        criarJogo,
        aplicar,
        celulas,
        celulasPeca,
        empacotar,
        desempacotar,
        reproduzir
    };
});