(() => {
    const abaPontos =
        document.getElementById(
            "ranking-aba-pontos"
        );

    const abaMediaAtiva =
        document.getElementById(
            "ranking-aba-media-ativa"
        );

    const abaBaus =
        document.getElementById(
            "ranking-aba-baus"
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

    const rankingPremiosDiamantes =
        document.getElementById(
            "ranking-premios-diamantes"
        );

    const rankingPremiosBaus =
        document.getElementById(
            "ranking-premios-baus"
        );

    const regrasMediaArea =
        document.getElementById(
            "ranking-regras-media-area"
        );

    const regrasMediaBotao =
        document.getElementById(
            "ranking-regras-media-botao"
        );

    const regrasMediaConteudo =
        document.getElementById(
            "ranking-regras-media-conteudo"
        );

    const botaoAbrirRanking =
        document.getElementById(
            "abrir-ranking"
        );

    if (
        !abaPontos ||
        !abaMediaAtiva ||
        !abaBaus ||
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

    function criarLinhaMediaAtiva(
        item,
        destaque = false
    ) {
        const linha =
            document.createElement(
                "div"
            );

        const classes = [
            "ranking-linha"
        ];

        if (destaque) {
            classes.push(
                "ranking-eu"
            );
        }

        if (
            item.ganhador ===
            true
        ) {
            classes.push(
                "ranking-ganhador-media"
            );
        }

        linha.className =
            classes.join(" ");

        const posicao =
            document.createElement(
                "span"
            );

        posicao.className =
            "ranking-posicao";

        const posicaoReal =
            `${Number(
                item.posicao
            )}º`;

        const medalhas = {
            1: "🥇",
            2: "🥈",
            3: "🥉"
        };

        const medalha =
            item.ganhador === true
                ? medalhas[
                Number(
                    item.posicaoPremio
                )
                ] || ""
                : "";

        posicao.textContent =
            medalha
                ? `${medalha} ${posicaoReal}`
                : posicaoReal;

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

        const media =
            document.createElement(
                "strong"
            );

        media.className =
            "ranking-pontos";

        media.textContent =
            `${Number(
                item.media || 0
            ).toLocaleString(
                "pt-BR"
            )} média`;

        linha.appendChild(
            posicao
        );

        linha.appendChild(
            nome
        );

        linha.appendChild(
            media
        );

        return linha;
    }

    function criarLinhaBaus(
        item,
        destaque = false
    ) {
        const linha =
            document.createElement(
                "div"
            );

        const classes = [
            "ranking-linha"
        ];

        if (destaque) {
            classes.push(
                "ranking-eu"
            );
        }

        if (
            item.ganhador ===
            true
        ) {
            classes.push(
                "ranking-ganhador-baus"
            );
        }

        linha.className =
            classes.join(" ");

        const posicao =
            document.createElement(
                "span"
            );

        posicao.className =
            "ranking-posicao";

        const posicaoReal =
            `${Number(
                item.posicao
            )}º`;

        const medalhas = {
            1: "🥇",
            2: "🥈",
            3: "🥉"
        };

        const medalha =
            item.ganhador === true
                ? medalhas[
                Number(
                    item.posicaoPremio
                )
                ] || ""
                : "";

        posicao.textContent =
            medalha
                ? `${medalha} ${posicaoReal}`
                : posicaoReal;

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

        const pontos =
            document.createElement(
                "strong"
            );

        pontos.className =
            "ranking-pontos";

        pontos.textContent =
            `${Number(
                item.pontosBaus || 0
            ).toLocaleString(
                "pt-BR"
            )} pts`;

        linha.appendChild(
            posicao
        );

        linha.appendChild(
            nome
        );

        linha.appendChild(
            pontos
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

    function mostrarMinhaPosicaoMediaAtiva(
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

        const medalhas = {
            1: "🥇",
            2: "🥈",
            3: "🥉"
        };

        const medalha =
            item.ganhador === true
                ? medalhas[
                Number(
                    item.posicaoPremio
                )
                ] || ""
                : "";

        const posicaoReal =
            `${Number(
                item.posicao
            )}º`;

        posicao.textContent =
            medalha
                ? `${medalha} ${posicaoReal}`
                : posicaoReal;

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

        const media =
            document.createElement(
                "strong"
            );

        media.className =
            "ranking-pontos";

        media.textContent =
            `${Number(
                item.media || 0
            ).toLocaleString(
                "pt-BR"
            )} média`;

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
                media
            );

        minhaPosicaoRanking.hidden =
            false;
    }

    function mostrarMinhaPosicaoBaus(
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

        const medalhas = {
            1: "🥇",
            2: "🥈",
            3: "🥉"
        };

        const medalha =
            item.ganhador === true
                ? medalhas[
                Number(
                    item.posicaoPremio
                )
                ] || ""
                : "";

        const posicaoReal =
            `${Number(
                item.posicao
            )}º`;

        posicao.textContent =
            medalha
                ? `${medalha} ${posicaoReal}`
                : posicaoReal;

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

        const pontos =
            document.createElement(
                "strong"
            );

        pontos.className =
            "ranking-pontos";

        pontos.textContent =
            `${Number(
                item.pontosBaus || 0
            ).toLocaleString(
                "pt-BR"
            )} pts`;

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
                pontos
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

        abaBaus.classList.remove(
            "ativa"
        );

        abaMediaAtiva.classList.remove(
            "ativa"
        );

        abaDiamantes.classList.remove(
            "ativa"
        );

        if (regrasMediaArea) {
            regrasMediaArea.hidden =
                true;
        }

        if (regrasMediaConteudo) {
            regrasMediaConteudo.hidden =
                true;
        }

        if (rankingPremios) {
            rankingPremios.hidden =
                false;
        }

        if (
            rankingPremiosDiamantes
        ) {
            rankingPremiosDiamantes.hidden =
                true;
        }

        if (rankingPremiosBaus) {
            rankingPremiosBaus.hidden =
                true;
        }

        if (rankingSubtitulo) {
            rankingSubtitulo.textContent =
                subtituloPontos;
        }
    }

    function mostrarAbaMediaAtiva() {

        abaPontos.classList.remove(
            "ativa"
        );

        abaMediaAtiva.classList.add(
            "ativa"
        );

        abaBaus.classList.remove(
            "ativa"
        );

        abaDiamantes.classList.remove(
            "ativa"
        );

        if (regrasMediaArea) {
            regrasMediaArea.hidden =
                false;
        }

        if (rankingPremios) {
            rankingPremios.hidden =
                true;
        }


        if (
            rankingPremiosDiamantes
        ) {
            rankingPremiosDiamantes.hidden =
                true;
        }

        if (rankingPremiosBaus) {
            rankingPremiosBaus.hidden =
                true;
        }

        if (rankingSubtitulo) {
            rankingSubtitulo.textContent =
                "Média histórica de participantes ativos";
        }
    }

    function mostrarAbaBaus() {
        abaPontos.classList.remove(
            "ativa"
        );

        abaMediaAtiva.classList.remove(
            "ativa"
        );

        abaBaus.classList.add(
            "ativa"
        );

        abaDiamantes.classList.remove(
            "ativa"
        );

        if (regrasMediaArea) {
            regrasMediaArea.hidden =
                true;
        }

        if (regrasMediaConteudo) {
            regrasMediaConteudo.hidden =
                true;
        }

        if (rankingPremios) {
            rankingPremios.hidden =
                true;
        }

        if (
            rankingPremiosDiamantes
        ) {
            rankingPremiosDiamantes.hidden =
                true;
        }

        if (rankingPremiosBaus) {
            rankingPremiosBaus.hidden =
                false;
        }

        if (rankingSubtitulo) {
            rankingSubtitulo.textContent =
                "Pontos conquistados nos Baús";
        }
    }

    function mostrarAbaDiamantes() {

        abaPontos.classList.remove(
            "ativa"
        );

        abaMediaAtiva.classList.remove(
            "ativa"
        );

        abaBaus.classList.remove(
            "ativa"
        );

        abaDiamantes.classList.add(
            "ativa"
        );

        if (regrasMediaArea) {
            regrasMediaArea.hidden =
                true;
        }

        if (regrasMediaConteudo) {
            regrasMediaConteudo.hidden =
                true;
        }

        if (rankingPremios) {
            rankingPremios.hidden =
                true;
        }

        if (
            rankingPremiosDiamantes
        ) {
            rankingPremiosDiamantes.hidden =
                false;
        }

        if (rankingPremiosBaus) {
            rankingPremiosBaus.hidden =
                true;
        }

        if (rankingSubtitulo) {
            rankingSubtitulo.textContent =
                "Quem mais encontrou diamantes";
        }
    }

    // ========================================
    // CARREGAR MÉDIA ATIVA
    // ========================================

    async function carregarRankingMediaAtiva() {

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
            "Carregando média ativa...";


        rankingLista.appendChild(
            carregando
        );


        try {

            const resposta =
                await fetch(
                    "/api/ranking-media-ativa",
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
                    "Ainda não há dados sulficientes.";


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
                            criarLinhaMediaAtiva(
                                item,
                                souEu
                            )
                        );
                }
            }


            mostrarMinhaPosicaoMediaAtiva(
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
                "❌ Erro ao carregar ranking de média ativa:",
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
                "❌ Não foi possível carregar a média ativa.";


            rankingLista.appendChild(
                erroElemento
            );
        }
    }

    // ========================================
    // CARREGAR BAÚS
    // ========================================
    async function carregarRankingBaus() {
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
            "Carregando ranking de baús...";

        rankingLista.appendChild(
            carregando
        );

        try {

            const resposta =
                await fetch(
                    "/api/ranking-baus",
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
                    "Ainda ninguém ganhou pontos nos baús.";

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
                            criarLinhaBaus(
                                item,
                                souEu
                            )
                        );
                }
            }

            mostrarMinhaPosicaoBaus(
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
                "❌ Erro ao carregar ranking de baús:",
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
                "❌ Não foi possível carregar o ranking de baús.";

            rankingLista.appendChild(
                erroElemento
            );
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

    if (
        regrasMediaBotao &&
        regrasMediaConteudo
    ) {
        regrasMediaBotao
            .addEventListener(
                "click",
                () => {

                    const vaiAbrir =
                        regrasMediaConteudo
                            .hidden === true;


                    regrasMediaConteudo.hidden =
                        !vaiAbrir;


                    regrasMediaBotao.textContent =
                        vaiAbrir
                            ? "✕ Fechar regras"
                            : "📖 Regras da Média Ativa";
                }
            );
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

    abaMediaAtiva.addEventListener(
        "click",
        () => {
            mostrarAbaMediaAtiva();
            carregarRankingMediaAtiva();
        }
    );

    abaBaus.addEventListener(
        "click",
        () => {
            mostrarAbaBaus();
            carregarRankingBaus();
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