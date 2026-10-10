(function () {
    const telegram = window.Telegram?.WebApp;
    const initData = telegram?.initData || "";

    const telaModos = document.getElementById("tela-modos");
    const telaMemoria = document.getElementById("tela-memoria");
    const botaoAbrir = document.getElementById("abrir-memoria");
    const botaoVoltar = document.getElementById("voltar-menu-memoria");
    const grade = document.getElementById("memoria-grade");
    const resultado = document.getElementById("resultado-memoria");
    const status = document.getElementById("status-memoria");

    if (!telaMemoria || !botaoAbrir || !botaoVoltar || !grade) {
        console.error("Elementos do jogo da mem\u00f3ria n\u00e3o encontrados.");
        return;
    }

    let partida = null;
    let bloqueado = false;
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

    function mostrarTela() {
        document.querySelectorAll("main > .tela").forEach(tela => {
            tela.hidden = true;
        });

        telaMemoria.hidden = false;
        carregarPartida();
    }

    function voltarMenu() {
        telaMemoria.hidden = true;
        if (telaModos) {
            telaModos.hidden = false;
        }
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
            throw new Error(dados.erro || "Erro no jogo.");
        }

        return dados;
    }

    async function carregarPartida() {
        resultado.textContent = "Carregando jogo...";

        try {
            partida = await requisicao("/api/memoria/iniciar", {});
            criarGrade(partida.totalCartas);
            cartasVisiveis.clear();
            atualizarGrade(partida);

            if (partida.status === "concluida") {
                bloqueado = true;
                resultado.textContent = partida.premioGanho
                    ? "\u{1F389} Voc\u00ea completou e ganhou R$ 10!"
                    : "Voc\u00ea completou, mas os pr\u00eamios j\u00e1 haviam acabado.";
            } else {
                bloqueado = false;
                resultado.textContent =
                    `Encontre os ${partida.totalPares} pares. Os 10 primeiros ganham R$ 10.`;
            }

            status.textContent =
                `Pares: ${partida.paresEncontrados}/${partida.totalPares}`;
        } catch (erro) {
            resultado.textContent = `\u274C ${erro.message}`;
        }
    }

    async function clicarCarta(indice) {
        if (bloqueado) return;

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

            if (dados.tipo === "primeira") {
                cartasVisiveis.set(
                    dados.indice,
                    normalizarEmoji(dados.emoji)
                );
                atualizarGrade(dados);
                bloqueado = false;
                atualizarGrade(dados);
            } else {
                for (const carta of dados.cartas || []) {
                    cartasVisiveis.set(
                        carta.indice,
                        normalizarEmoji(carta.emoji)
                    );
                }

                atualizarGrade(dados);
                status.textContent =
                    `Pares: ${dados.paresEncontrados}/${dados.totalPares}`;

                if (dados.status === "concluida") {
                    resultado.textContent = dados.premioGanho
                        ? `\u{1F389} Parab\u00e9ns! Voc\u00ea ganhou ${dados.premio}.`
                        : "Voc\u00ea completou, mas os 10 pr\u00eamios j\u00e1 acabaram.";
                    bloqueado = true;
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
            }
        } catch (erro) {
            resultado.textContent = `\u274C ${erro.message}`;
            bloqueado = false;
        } finally {
            botao.classList.remove("carregando");
        }
    }

botaoAbrir.addEventListener("click", mostrarTela);
botaoVoltar.addEventListener("click", voltarMenu);
})();