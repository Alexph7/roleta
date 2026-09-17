(() => {

    const abaPontos =
        document.getElementById(
            "ranking-aba-pontos"
        );


    const abaDiamantes =
        document.getElementById(
            "ranking-aba-diamantes"
        );


    const rankingLista =
        document.getElementById(
            "ranking-lista"
        );


    const minhaPosicaoRanking =
        document.getElementById(
            "minha-posicao-ranking"
        );


    const rankingSubtitulo =
        document.querySelector(
            "#tela-ranking .ranking-subtitulo"
        );


    const rankingPremios =
        document.querySelector(
            "#tela-ranking .ranking-premios"
        );


    const botaoAbrirRanking =
        document.getElementById(
            "abrir-ranking"
        );


    if (
        !abaPontos ||
        !abaDiamantes ||
        !rankingLista ||
        !minhaPosicaoRanking
    ) {
        return;
    }


    const initData =
        window.Telegram
            ?.WebApp
            ?.initData || "";


    const subtituloPontos =
        rankingSubtitulo
            ?.textContent
            ?.trim() ||
        "Campeonato de pontos";


    let versaoCarregamento =
        0;


    // ========================================
    // POSIÇÃO
    // ========================================

    function textoPosicao(
        posicao
    ) {
        const numero =
            Number(
                posicao
            );


        if (numero === 1) {
            return "🥇";
        }


        if (numero === 2) {
            return "🥈";
        }


        if (numero === 3) {
            return "🥉";
        }


        return `${numero}º`;
    }


    // ========================================
    // NOME CLICÁVEL
    // ========================================

    function prepararNome(
        nome,
        usuarioId
    ) {
        if (!usuarioId) {
            return;
        }


        nome.classList.add(
            "ranking-nome-clicavel"
        );


        nome.addEventListener(
            "click",
            () => {

                if (
                    typeof window
                        .abrirPerfilPublico ===
                    "function"
                ) {
                    window
                        .abrirPerfilPublico(
                            usuarioId
                        );
                }
            }
        );
    }


    // ========================================
    // LINHA DO RANKING
    // ========================================

    function criarLinhaDiamantes(
        item,
        destaque = false
    ) {
        const linha =
            document.createElement(
                "div"
            );


        linha.className =
            destaque
                ? "ranking-linha ranking-eu"
                : "ranking-linha";


        const posicao =
            document.createElement(
                "span"
            );


        posicao.className =
            "ranking-posicao";


        posicao.textContent =
            textoPosicao(
                item.posicao
            );


        const nome =
            document.createElement(
                "strong"
            );


        nome.className =
            "ranking-nome";


        nome.textContent =
            item.nome ||
            "Participante";


        prepararNome(
            nome,
            item.usuarioId
        );


        const diamantes =
            document.createElement(
                "strong"
            );


        diamantes.className =
            "ranking-pontos";


        diamantes.textContent =
            `${Number(
                item.diamantes || 0
            ).toLocaleString(
                "pt-BR"
            )} 💎`;


        linha.appendChild(
            posicao
        );


        linha.appendChild(
            nome
        );


        linha.appendChild(
            diamantes
        );


        return linha;
    }


    // ========================================
    // MINHA POSIÇÃO
    // ========================================

    function mostrarMinhaPosicao(
        item
    ) {
        minhaPosicaoRanking
            .replaceChildren();


        if (!item) {
            minhaPosicaoRanking.hidden =
                true;

            return;
        }


        const posicao =
            document.createElement(
                "span"
            );


        posicao.className =
            "ranking-posicao";


        posicao.textContent =
            textoPosicao(
                item.posicao
            );


        const nome =
            document.createElement(
                "strong"
            );


        nome.className =
            "ranking-nome";


        nome.textContent =
            item.nome ||
            "Você";


        prepararNome(
            nome,
            item.usuarioId
        );


        const diamantes =
            document.createElement(
                "strong"
            );


        diamantes.className =
            "ranking-pontos";


        diamantes.textContent =
            `${Number(
                item.diamantes || 0
            ).toLocaleString(
                "pt-BR"
            )} 💎`;


        minhaPosicaoRanking
            .appendChild(
                posicao
            );


        minhaPosicaoRanking
            .appendChild(
                nome
            );


        minhaPosicaoRanking
            .appendChild(
                diamantes
            );


        minhaPosicaoRanking.hidden =
            false;
    }


    // ========================================
    // VISUAL DAS ABAS
    // ========================================

    function mostrarAbaPontos() {

        abaPontos.classList.add(
            "ativa"
        );


        abaDiamantes.classList.remove(
            "ativa"
        );


        if (rankingPremios) {
            rankingPremios.hidden =
                false;
        }


        if (rankingSubtitulo) {
            rankingSubtitulo.textContent =
                subtituloPontos;
        }
    }


    function mostrarAbaDiamantes() {

        abaPontos.classList.remove(
            "ativa"
        );


        abaDiamantes.classList.add(
            "ativa"
        );


        if (rankingPremios) {
            rankingPremios.hidden =
                true;
        }


        if (rankingSubtitulo) {
            rankingSubtitulo.textContent =
                "Quem mais encontrou diamantes";
        }
    }


    // ========================================
    // CARREGAR DIAMANTES
    // ========================================

    async function carregarRankingDiamantes() {

        const minhaVersao =
            ++versaoCarregamento;


        rankingLista
            .replaceChildren();


        minhaPosicaoRanking.hidden =
            true;


        minhaPosicaoRanking
            .replaceChildren();


        const carregando =
            document.createElement(
                "p"
            );


        carregando.className =
            "ranking-carregando";


        carregando.textContent =
            "Carregando ranking de diamantes...";


        rankingLista.appendChild(
            carregando
        );


        try {

            const resposta =
                await fetch(
                    "/api/ranking-diamantes",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                initData
                            })
                    }
                );


            const dados =
                await resposta.json();


            if (
                minhaVersao !==
                versaoCarregamento
            ) {
                return;
            }


            if (!resposta.ok) {
                throw new Error(
                    dados.erro ||
                    "Ranking indisponível"
                );
            }


            rankingLista
                .replaceChildren();


            const ranking =
                Array.isArray(
                    dados.ranking
                )
                    ? dados.ranking
                    : [];


            const minhaPosicao =
                dados.usuario ||
                null;


            if (
                ranking.length === 0
            ) {
                const vazio =
                    document.createElement(
                        "p"
                    );


                vazio.className =
                    "ranking-vazio";


                vazio.textContent =
                    "Ainda ninguém encontrou diamantes.";


                rankingLista.appendChild(
                    vazio
                );

            } else {

                for (
                    const item
                    of ranking
                ) {
                    const souEu =
                        minhaPosicao &&
                        String(
                            item.usuarioId
                        ) ===
                        String(
                            minhaPosicao
                                .usuarioId
                        );


                    rankingLista
                        .appendChild(
                            criarLinhaDiamantes(
                                item,
                                souEu
                            )
                        );
                }
            }


            mostrarMinhaPosicao(
                minhaPosicao
            );


        } catch (erro) {

            if (
                minhaVersao !==
                versaoCarregamento
            ) {
                return;
            }


            console.error(
                "❌ Erro ao carregar ranking de diamantes:",
                erro
            );


            rankingLista
                .replaceChildren();


            const erroElemento =
                document.createElement(
                    "p"
                );


            erroElemento.className =
                "ranking-vazio";


            erroElemento.textContent =
                "❌ Não foi possível carregar o ranking de diamantes.";


            rankingLista.appendChild(
                erroElemento
            );
        }
    }


    // ========================================
    // CLIQUES
    // ========================================

    abaPontos.addEventListener(
        "click",
        () => {

            ++versaoCarregamento;

            mostrarAbaPontos();


            if (
                typeof window
                    .carregarRanking ===
                "function"
            ) {
                window
                    .carregarRanking();
            }
        }
    );


    abaDiamantes.addEventListener(
        "click",
        () => {

            mostrarAbaDiamantes();

            carregarRankingDiamantes();
        }
    );


    // Sempre que entrar no Ranking,
    // começa na aba de Pontos.
    botaoAbrirRanking
        ?.addEventListener(
            "click",
            () => {

                ++versaoCarregamento;

                mostrarAbaPontos();
            }
        );

})();