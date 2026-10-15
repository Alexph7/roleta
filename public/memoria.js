(function () {
    const telegram = window.Telegram?.WebApp;
    const initData = telegram?.initData || "";

    const el = id => document.getElementById(id);

    const telaModos = el("tela-modos");
    const telaMemoria = el("tela-memoria");
    const botaoAbrir = el("abrir-memoria");
    const botaoVoltar = el("voltar-menu-memoria");

    const regras = el("memoria-regras");
    const regrasFim = el("memoria-regras-fim");
    const proximaEl = el("memoria-proxima");
    const avisoEl = el("memoria-aviso");
    const botaoComecar = el("memoria-comecar");

    const jogo = el("memoria-jogo");
    const placarPartida = el("memoria-placar-partida");
    const placarJogadas = el("memoria-placar-jogadas");
    const placarPares = el("memoria-placar-pares");
    const grade = el("memoria-grade");
    const resultado = el("resultado-memoria");

    const rankingInfo = el("memoria-ranking-info");
    const rankingLista = el("memoria-ranking-lista");
    const minhaPosicao = el("memoria-minha-posicao");

    if (
        !telaMemoria || !botaoAbrir || !botaoVoltar || !grade ||
        !regras || !jogo || !botaoComecar || !rankingLista
    ) {
        console.error("Elementos do jogo da memoria nao encontrados.");
        return;
    }

    let partida = null;
    let bloqueado = false;
    let jogou = false;
    let concluida = false;
    let intervaloRanking = null;
    const cartasVisiveis = new Map();

    function normalizarEmoji(valor) {
        if (typeof valor !== "string" || !/[ÃÂðâ]/.test(valor)) {
            return valor;
        }

        const mapaWindows1252 = {
            "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84,
            "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
            "‰": 0x89, "Š": 0x8A, "‹": 0x8B, "Œ": 0x8C,
            "Ž": 0x8E, "‘": 0x91, "’": 0x92, "“": 0x93,
            "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
            "˜": 0x98, "™": 0x99, "š": 0x9A, "›": 0x9B,
            "œ": 0x9C, "ž": 0x9E, "Ÿ": 0x9F
        };

        try {
            const bytes = new Uint8Array(
                [...valor].map(caractere => {
                    const codigo = caractere.charCodeAt(0);

                    return codigo <= 0xFF
                        ? codigo
                        : mapaWindows1252[caractere] || 0x3F;
                })
            );

            const corrigido = new TextDecoder("utf-8").decode(bytes);

            return corrigido.includes("\uFFFD")
                ? valor
                : corrigido;
        } catch (_) {
            return valor;
        }
    }

    function formatarFim(ms) {
        try {
            const partes = new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Sao_Paulo",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23"
            }).formatToParts(new Date(ms));

            const v = {};
            for (const p of partes) {
                if (p.type !== "literal") v[p.type] = p.value;
            }

            return `${v.day}/${v.month} às ${v.hour}:${v.minute}`;
        } catch (_) {
            return "--";
        }
    }

    async function requisicao(url, corpo) {
        const resposta = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                initData,
                ...corpo
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            const erro = new Error(dados.erro || "Erro no jogo.");
            erro.encerrado = dados.encerrado === true;
            throw erro;
        }

        return dados;
    }

    // ==============================
    // TELAS
    // ==============================

    function mostrarRegras() {
        regras.hidden = false;
        jogo.hidden = true;
        resultado.textContent = "";
        partida = null;
        bloqueado = false;
        jogou = false;
        concluida = false;
        cartasVisiveis.clear();
    }

    function mostrarTela() {
        document.querySelectorAll("main > .tela").forEach(tela => {
            tela.hidden = true;
        });

        telaMemoria.hidden = false;
        mostrarRegras();
        carregarEstado();
        carregarRanking();
        iniciarAtualizacaoRanking();
    }

    function sairDaTela() {
        pararAtualizacaoRanking();
        telaMemoria.hidden = true;
        mostrarRegras();

        if (telaModos) {
            telaModos.hidden = false;
        }
    }

    function confirmar(mensagem, aoResponder) {
        if (telegram && typeof telegram.showConfirm === "function") {
            telegram.showConfirm(mensagem, aoResponder);
            return;
        }

        aoResponder(window.confirm(mensagem));
    }

    function voltarMenu() {
        if (jogou && !concluida) {
            confirmar(
                "Sair agora conta como partida abandonada. " +
                "Sua próxima partida será numerada mais alto. Sair mesmo assim?",
                ok => {
                    if (ok) sairDaTela();
                }
            );
            return;
        }

        sairDaTela();
    }

    // ==============================
    // ANTES DE COMEÇAR
    // ==============================

    async function carregarEstado() {
        avisoEl.textContent = "";
        proximaEl.textContent = "";
        botaoComecar.hidden = false;
        botaoComecar.disabled = true;
        botaoComecar.textContent = "CARREGANDO...";

        try {
            const e = await requisicao("/api/memoria/estado", {});

            regrasFim.textContent = formatarFim(e.fimEm);

            if (e.jaConcluiu) {
                botaoComecar.hidden = true;

                const r = e.meuResultado;

                avisoEl.textContent = r
                    ? `Você já concluiu: Partida ${r.numeroPartida}, ` +
                      `${r.jogadas} jogadas, ${r.posicao}º lugar.`
                    : "Você já concluiu o jogo.";

                return;
            }

            if (e.encerrado) {
                botaoComecar.hidden = true;
                avisoEl.textContent = "O jogo terminou.";
                return;
            }

            if (e.abandonou) {
                avisoEl.textContent =
                    "Sua partida anterior foi abandonada.";
            }

            proximaEl.textContent =
                `Sua próxima partida será a Partida ${e.proximaPartida}.`;

            botaoComecar.disabled = false;
            botaoComecar.textContent = "COMEÇAR";
        } catch (erro) {
            avisoEl.textContent = `❌ ${erro.message}`;
            botaoComecar.hidden = true;
        }
    }

    async function comecar() {
        botaoComecar.disabled = true;

        try {
            const dados = await requisicao("/api/memoria/iniciar", {});

            if (dados.status === "concluida") {
                carregarEstado();
                carregarRanking();
                return;
            }

            partida = dados;
            jogou = false;
            concluida = false;
            bloqueado = false;
            cartasVisiveis.clear();

            criarGrade(partida.totalCartas);
            atualizarGrade(partida);
            atualizarPlacar(partida);

            regras.hidden = true;
            jogo.hidden = false;

            resultado.textContent =
                `Encontre os ${partida.totalPares} pares com o menor ` +
                "número de jogadas.";
        } catch (erro) {
            avisoEl.textContent = `❌ ${erro.message}`;
            botaoComecar.disabled = false;
        }
    }

    // ==============================
    // JOGO
    // ==============================

    function atualizarPlacar(dados) {
        placarPartida.textContent = String(dados.numeroPartida);
        placarJogadas.textContent = String(dados.jogadas);
        placarPares.textContent =
            `${dados.paresEncontrados}/${dados.totalPares}`;
    }

    function criarGrade(totalCartas) {
        grade.replaceChildren();

        for (let indice = 0; indice < totalCartas; indice++) {
            const botao = document.createElement("button");

            botao.type = "button";
            botao.className = "memoria-carta";
            botao.dataset.indice = String(indice);
            botao.textContent = "";

            botao.addEventListener(
                "click",
                () => clicarCarta(indice)
            );

            grade.appendChild(botao);
        }
    }

    function atualizarGrade(dados) {
        if (!dados) return;

        for (const item of dados.cartasEncontradas || []) {
            cartasVisiveis.set(
                item.indice,
                normalizarEmoji(item.emoji)
            );
        }

        if (
            dados.indiceSelecionado !== null &&
            dados.indiceSelecionado !== undefined &&
            dados.emojiSelecionado
        ) {
            cartasVisiveis.set(
                dados.indiceSelecionado,
                normalizarEmoji(dados.emojiSelecionado)
            );
        }

        grade.querySelectorAll(".memoria-carta").forEach(botao => {
            const indice = Number(botao.dataset.indice);
            const emoji = cartasVisiveis.get(indice);
            const encontrado =
                (dados.indicesEncontrados || []).includes(indice);

            botao.textContent = emoji || "";
            botao.classList.toggle("aberta", Boolean(emoji));
            botao.classList.toggle("encontrada", encontrado);
            botao.disabled = encontrado || bloqueado;
        });
    }

    async function clicarCarta(indice) {
        if (bloqueado || concluida) return;

        const botao = grade.querySelector(
            `[data-indice="${indice}"]`
        );

        if (!botao || botao.disabled) return;

        bloqueado = true;
        botao.classList.add("carregando");

        try {
            const dados = await requisicao("/api/memoria/jogada", {
                indice
            });

            jogou = true;

            if (dados.tipo === "primeira") {
                cartasVisiveis.set(
                    dados.indice,
                    normalizarEmoji(dados.emoji)
                );

                bloqueado = false;
                atualizarPlacar(dados);
                atualizarGrade(dados);
                return;
            }

            for (const carta of dados.cartas || []) {
                cartasVisiveis.set(
                    carta.indice,
                    normalizarEmoji(carta.emoji)
                );
            }

            atualizarPlacar(dados);
            atualizarGrade(dados);

            if (dados.status === "concluida") {
                concluida = true;
                bloqueado = true;

                const r = dados.meuResultado;

                resultado.textContent = r
                    ? `Concluído! Partida ${r.numeroPartida}, ` +
                      `${r.jogadas} jogadas. Você está em ${r.posicao}º lugar.`
                    : `Concluído em ${dados.jogadas} jogadas.`;

                carregarRanking();
                return;
            }

            if (!dados.combinou) {
                await new Promise(resolve =>
                    setTimeout(resolve, dados.aguardarMs || 900)
                );

                for (const carta of dados.cartas || []) {
                    cartasVisiveis.delete(carta.indice);
                }
            }

            bloqueado = false;
            atualizarGrade(dados);
        } catch (erro) {
            resultado.textContent = `❌ ${erro.message}`;
            bloqueado = false;
        } finally {
            botao.classList.remove("carregando");
        }
    }

    // ==============================
    // RANKING
    // ==============================

    function criarLinhaRanking(item, souEu) {
        const linha = document.createElement("div");

        linha.className = "memoria-rk-linha" +
            (souEu ? " memoria-rk-eu" : "") +
            (item.premiado ? " memoria-rk-premiado" : "");

        const posicao = document.createElement("span");
        posicao.className = "memoria-rk-pos";
        posicao.textContent = `${item.posicao}º`;

        const nome = document.createElement("span");
        nome.className = "memoria-rk-nome";
        nome.textContent = item.nome || "Participante";

        const dados = document.createElement("strong");
        dados.className = "memoria-rk-dados";
        dados.textContent =
            `P${item.numeroPartida} · ${item.jogadas} jog.`;

        linha.append(posicao, nome, dados);

        return linha;
    }

    async function carregarRanking() {
        try {
            const d = await requisicao("/api/memoria/ranking", {});

            rankingInfo.textContent =
                `Os ${d.qtdPremiados} primeiros ganham ${d.premio}. ` +
                "Ordem: primeiro a partida, depois as jogadas. " +
                (d.encerrado
                    ? "Resultado final."
                    : `Termina em ${formatarFim(d.fimEm)}.`);

            rankingLista.replaceChildren();

            if (!d.ranking.length) {
                const vazio = document.createElement("p");
                vazio.className = "memoria-rk-vazio";
                vazio.textContent = "Ninguém concluiu ainda.";
                rankingLista.appendChild(vazio);
            }

            for (const item of d.ranking) {
                rankingLista.appendChild(
                    criarLinhaRanking(
                        item,
                        Boolean(d.meu) && d.meu.posicao === item.posicao
                    )
                );
            }

            if (d.meu && d.meu.posicao > d.ranking.length) {
                minhaPosicao.textContent =
                    `Sua posição: ${d.meu.posicao}º · ` +
                    `P${d.meu.numeroPartida} · ${d.meu.jogadas} jog.`;
                minhaPosicao.hidden = false;
            } else {
                minhaPosicao.hidden = true;
            }
        } catch (erro) {
            console.error("Erro ao carregar ranking da memória:", erro);
        }
    }

    function iniciarAtualizacaoRanking() {
        pararAtualizacaoRanking();

        intervaloRanking = setInterval(() => {
            if (telaMemoria.hidden) {
                pararAtualizacaoRanking();
                return;
            }

            carregarRanking();
        }, 10000);
    }

    function pararAtualizacaoRanking() {
        if (intervaloRanking) {
            clearInterval(intervaloRanking);
            intervaloRanking = null;
        }
    }

    botaoAbrir.addEventListener("click", mostrarTela);
    botaoVoltar.addEventListener("click", voltarMenu);
    botaoComecar.addEventListener("click", comecar);
})();