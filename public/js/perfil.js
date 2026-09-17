(() => {

    // ========================================
    // CSS DO PERFIL
    // ========================================

    if (
        !document.getElementById(
            "perfil-css"
        )
    ) {

        const link =
            document.createElement(
                "link"
            );

        link.id =
            "perfil-css";

        link.rel =
            "stylesheet";

        link.href =
            "/css/perfil.css?v=1";

        document.head.appendChild(
            link
        );
    }


    // ========================================
    // MENU
    // ========================================

    const telaMenu =
        document.getElementById(
            "tela-menu"
        );


    if (!telaMenu) {

        console.error(
            "❌ tela-menu não encontrada"
        );

        return;
    }


    let botaoAbrirPerfil =
        document.getElementById(
            "abrir-perfil"
        );


    if (!botaoAbrirPerfil) {

        botaoAbrirPerfil =
            document.createElement(
                "button"
            );

        botaoAbrirPerfil.type =
            "button";

        botaoAbrirPerfil.id =
            "abrir-perfil";

        botaoAbrirPerfil.className =
            "card-jogo perfil-card-menu";


        const icone =
            document.createElement(
                "span"
            );

        icone.className =
            "card-jogo-icone";

        icone.textContent =
            "👤";


        const titulo =
            document.createElement(
                "strong"
            );

        titulo.textContent =
            "MEU PERFIL";


        const subtitulo =
            document.createElement(
                "span"
            );

        subtitulo.className =
            "perfil-card-subtitulo";

        subtitulo.textContent =
            "Veja suas estatísticas";


        botaoAbrirPerfil.appendChild(
            icone
        );

        botaoAbrirPerfil.appendChild(
            titulo
        );

        botaoAbrirPerfil.appendChild(
            subtitulo
        );


        // ========================================
        // COLOCA DEPOIS DO RANKING
        // ========================================

        const botaoRanking =
            document.getElementById(
                "abrir-ranking"
            );


        const cardRanking =
            botaoRanking
                ?.closest(
                    ".card-jogo"
                ) ||
            botaoRanking;


        if (
            cardRanking &&
            cardRanking.parentElement
        ) {

            cardRanking
                .insertAdjacentElement(
                    "afterend",
                    botaoAbrirPerfil
                );

        } else {

            telaMenu.appendChild(
                botaoAbrirPerfil
            );
        }
    }


    // ========================================
    // CRIAR TELA DO PERFIL
    // ========================================

    let telaPerfil =
        document.getElementById(
            "tela-perfil"
        );


    if (!telaPerfil) {

        telaPerfil =
            document.createElement(
                "section"
            );

        telaPerfil.id =
            "tela-perfil";

        telaPerfil.hidden =
            true;

        telaPerfil.innerHTML = `
            <div class="perfil-conteudo">

                <div class="perfil-cabecalho">

                    <div class="perfil-avatar">
                        👤
                    </div>

                    <h1 id="perfil-nome">
                        Carregando...
                    </h1>
                    
                </div>

                <h2 class="perfil-titulo-secao">
                ESTATÍSTICAS
            </h2>

            <div class="perfil-estatisticas">

                <div class="perfil-estatistica">
                    <span>🏆</span>

                <strong id="perfil-ranking">
                    -
                </strong>

                <small>
                    Posição Ranking
                </small>
            </div>


            <div class="perfil-estatistica">
                <span>⭐</span>

                <strong id="perfil-pontos">
                    0
                </strong>

                <small>
                    Pontos atuais
                </small>

                <small id="perfil-media-pontos">
                    Média por giro: 0
                </small>
            </div>


            <div class="perfil-estatistica">
                <span>🎯</span>

                <strong id="perfil-giros-pontos">
                    0
                </strong>

                <small>
                    Giros
                </small>
            </div>


            <div class="perfil-estatistica">
                <span>💎</span>

                <strong id="perfil-diamantes">
                    0
                </strong>

                <small>
                    Diamantes
                </small>
            </div>


            <div class="perfil-estatistica">
                <span>🎁</span>

                <strong id="perfil-baus">
                    0
                </strong>

                <small>
                    Baús
                </small>
            </div>


            <div class="perfil-estatistica">
                <span>🎡</span>

                <strong id="perfil-giros-premiada">
                    0
                </strong>

                <small>
                    Roleta Premiada
                </small>
            </div>

            </div>

            <div class="perfil-historico">

            <div class="perfil-historico-titulo">
                HISTÓRICO DE PONTOS
            </div>

            <div
                id="perfil-historico-lista"
                class="perfil-historico-lista"
            >
                <div class="perfil-historico-vazio">
                    Nenhum ponto ganho ainda.
                </div>
            </div>

        </div>

        <div class="perfil-desde">
                 <span>
                        Jogando desde
                    </span>
                    <strong id="perfil-desde">
                        -
                    </strong>
                </div>

                <p
                    id="perfil-status"
                    class="perfil-status"
                ></p>

                <button
                    type="button"
                    id="voltar-menu-perfil"
                    class="perfil-voltar"
                >
                    ← VOLTAR
                </button>

            </div>
        `;

        document.body.appendChild(
            telaPerfil
        );
    }

    // ========================================
    // ELEMENTOS
    // ========================================
    const botaoVoltar =
        document.getElementById(
            "voltar-menu-perfil"
        );

    const status =
        document.getElementById(
            "perfil-status"
        );

    const telegramPerfil =
        window.Telegram?.WebApp;

    const initDataPerfil =
        telegramPerfil?.initData ||
        "";

    // ========================================
    // FORMATAR DATA
    // ========================================
    function formatarData(
        timestamp
    ) {
        const numero =
            Number(timestamp || 0);

        if (!numero) {

            return "-";
        }
        return new Date(
            numero
        ).toLocaleDateString(
            "pt-BR",
            {
                timeZone:
                    "America/Sao_Paulo"
            }
        );
    }

    function formatarDataHistorico(
        timestamp
    ) {
        const numero =
            Number(
                timestamp || 0
            );
        if (!numero) {
            return "";
        }

        return new Date(
            numero
        ).toLocaleString(
            "pt-BR",
            {
                timeZone:
                    "America/Sao_Paulo",
                day:
                    "2-digit",
                month:
                    "2-digit",
                hour:
                    "2-digit",
                minute:
                    "2-digit"
            }
        );
    }

    function preencherHistoricoPontos(
        historico
    ) {
        const lista =
            document.getElementById(
                "perfil-historico-lista"
            );
        if (!lista) {
            return;
        }

        lista.replaceChildren();

        const itens =
            Array.isArray(
                historico
            )
                ? historico
                : [];

        if (
            itens.length === 0
        ) {
            const vazio =
                document.createElement(
                    "div"
                );

            vazio.className =
                "perfil-historico-vazio";

            vazio.textContent =
                "Nenhum ponto ganho ainda.";

            lista.appendChild(
                vazio
            );
            return;
        }

        for (
            const item
            of itens
        ) {
            const linha =
                document.createElement(
                    "div"
                );

            linha.className =
                "perfil-historico-linha";

            const esquerda =
                document.createElement(
                    "div"
                );

            esquerda.className =
                "perfil-historico-info";

            const valor =
                document.createElement(
                    "strong"
                );

            const pontos =
                Number(
                    item.pontos || 0
                );

            const multiplicador =
                Number(
                    item.multiplicador || 0
                );

            const textoMultiplicador =
                multiplicador > 0
                    ? `${multiplicador.toFixed(1)}x → `
                    : "";

            valor.textContent =
                `${item.icone || "🎯"} ` +
                `${textoMultiplicador}` +
                `+${pontos.toLocaleString(
                    "pt-BR"
                )} pts`;

            const origem =
                document.createElement(
                    "small"
                );

            origem.textContent =
                item.origem ||
                "Pontos";

            const data =
                document.createElement(
                    "span"
                );

            data.className =
                "perfil-historico-data";

            data.textContent =
                formatarDataHistorico(
                    item.criadoEm
                );

            esquerda.appendChild(
                valor
            );

            esquerda.appendChild(
                origem
            );

            linha.appendChild(
                esquerda
            );

            linha.appendChild(
                data
            );

            lista.appendChild(
                linha
            );
        }
    }

    // ========================================
    // PREENCHER PERFIL
    // ========================================

    function preencherPerfil(
        perfil
    ) {
        document.getElementById(
            "perfil-nome"
        ).textContent =
            perfil.nome ||
            "Participante";

        document.getElementById(
            "perfil-ranking"
        ).textContent =
            perfil.posicao
                ? `${perfil.posicao}º`
                : "-";

        document.getElementById(
            "perfil-pontos"
        ).textContent =
            Number(
                perfil.pontos || 0
            ).toLocaleString(
                "pt-BR"
            );

        document.getElementById(
            "perfil-media-pontos"
        ).textContent =
            `Média por giro: ${Number(
                perfil.mediaPontosPorGiro || 0
            ).toLocaleString(
                "pt-BR"
            )}`;

        document.getElementById(
            "perfil-giros-pontos"
        ).textContent =
            Number(
                perfil.girosPontos || 0
            ).toLocaleString(
                "pt-BR"
            );

        document.getElementById(
            "perfil-diamantes"
        ).textContent =
            Number(
                perfil.diamantes || 0
            ).toLocaleString(
                "pt-BR"
            );

        document.getElementById(
            "perfil-baus"
        ).textContent =
            Number(
                perfil.bausAbertos || 0
            ).toLocaleString(
                "pt-BR"
            );

        document.getElementById(
            "perfil-giros-premiada"
        ).textContent =
            Number(
                perfil.girosPremiada || 0
            ).toLocaleString(
                "pt-BR"
            );

        preencherHistoricoPontos(
            perfil.historicoPontos
        );

        document.getElementById(
            "perfil-desde"
        ).textContent =
            formatarData(
                perfil.criadoEm
            );
    }

    // ========================================
    // CARREGAR PERFIL
    // ========================================

    async function carregarPerfil(
        usuarioIdAlvo = null
    ) {
        status.textContent =
            "Carregando perfil...";

        try {
            const resposta =
                await fetch(
                    "/api/perfil",
                    {
                        method:
                            "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                initData:
                                    initDataPerfil,

                                usuarioIdAlvo:
                                    usuarioIdAlvo
                            })
                    }
                );

            const dados =
                await resposta.json();

            if (
                !resposta.ok ||
                !dados.perfil
            ) {
                throw new Error(
                    dados.erro ||
                    "Perfil indisponível"
                );
            }

            preencherPerfil(
                dados.perfil
            );

            status.textContent =
                "";

        } catch (erro) {
            console.error(
                "❌ Erro ao carregar perfil:",
                erro
            );

            status.textContent =
                "❌ Não foi possível carregar o perfil.";
        }
    }

    // ========================================
    // ABRIR / FECHAR
    // ========================================

    window.abrirPerfilPublico =
        function (
            usuarioId
        ) {
            const id =
                String(
                    usuarioId || ""
                ).trim();
            if (
                !/^\d{1,20}$/.test(
                    id
                )
            ) {
                return;
            }
            telaPerfil.hidden =
                false;
            carregarPerfil(
                id
            );
        };

    botaoAbrirPerfil
        .addEventListener(
            "click",
            () => {
                telaPerfil.hidden =
                    false;
                carregarPerfil();
            }
        );

    botaoVoltar
        .addEventListener(
            "click",
            () => {

                telaPerfil.hidden =
                    true;
            }
        );
})();