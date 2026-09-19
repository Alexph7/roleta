(() => {

    // ========================================
    // CSS
    // ========================================

    if (
        !document.getElementById(
            "news-css"
        )
    ) {
        const link =
            document.createElement(
                "link"
            );

        link.id =
            "news-css";

        link.rel =
            "stylesheet";

        link.href =
            "/css/news.css?v=1";

        document.head.appendChild(
            link
        );
    }


    // ========================================
    // ELEMENTOS DO MENU
    // ========================================

    const telaMenu =
        document.getElementById(
            "tela-menu"
        );


    const botaoPerfil =
        document.getElementById(
            "abrir-perfil"
        );


    const app =
        document.querySelector(
            ".app"
        );


    if (
        !telaMenu ||
        !botaoPerfil ||
        !app
    ) {
        return;
    }


    // ========================================
    // BOTÃO NEWS
    // ========================================

    let botaoNews =
        document.getElementById(
            "abrir-news"
        );


    if (
        !botaoNews
    ) {
        botaoNews =
            document.createElement(
                "button"
            );


        botaoNews.type =
            "button";


        botaoNews.id =
            "abrir-news";


        botaoNews.className =
            "perfil-topo-menu news-topo-menu";


        const icone =
            document.createElement(
                "div"
            );


        icone.className =
            "perfil-topo-icone";


        icone.textContent =
            "📰";


        const textos =
            document.createElement(
                "div"
            );


        textos.className =
            "perfil-topo-textos";


        const titulo =
            document.createElement(
                "strong"
            );


        titulo.textContent =
            "NEWS";


        const subtitulo =
            document.createElement(
                "span"
            );


        subtitulo.textContent =
            "Últimos acontecimentos";


        textos.appendChild(
            titulo
        );


        textos.appendChild(
            subtitulo
        );


        const seta =
            document.createElement(
                "span"
            );


        seta.className =
            "perfil-topo-seta";


        seta.textContent =
            "›";


        botaoNews.appendChild(
            icone
        );


        botaoNews.appendChild(
            textos
        );


        botaoNews.appendChild(
            seta
        );


        // IMEDIATAMENTE DEPOIS
        // DO MEU PERFIL

        botaoPerfil
            .insertAdjacentElement(
                "afterend",
                botaoNews
            );
    }


    // ========================================
    // TELA NEWS
    // ========================================

    let telaNews =
        document.getElementById(
            "tela-news"
        );


    if (
        !telaNews
    ) {
        telaNews =
            document.createElement(
                "section"
            );


        telaNews.id =
            "tela-news";


        telaNews.className =
            "tela";


        telaNews.hidden =
            true;


        telaNews.innerHTML = `
            <button
                id="voltar-menu-news"
                class="voltar-menu"
                type="button"
            >
                ← MENU
            </button>

            <h1 class="news-titulo">
                📰 News
            </h1>

            <p class="news-subtitulo">
                Últimos acontecimentos
            </p>

            <div
                id="news-lista"
                class="news-lista"
            >
                <p class="news-vazio">
                    Carregando...
                </p>
            </div>

            <button
                id="voltar-menu-news-flutuante"
                class="news-menu-flutuante"
                type="button"
            >
                ← MENU
            </button>
        `;


        app.appendChild(
            telaNews
        );
    }


    const botaoVoltar =
        document.getElementById(
            "voltar-menu-news"
        );

    const botaoVoltarFlutuante =
        document.getElementById(
            "voltar-menu-news-flutuante"
        );

    const lista =
        document.getElementById(
            "news-lista"
        );


    const initData =
        window.Telegram
            ?.WebApp
            ?.initData || "";


    // ========================================
    // DATA
    // ========================================

    function chaveData(
        timestamp
    ) {
        return new Intl
            .DateTimeFormat(
                "en-CA",
                {
                    timeZone:
                        "America/Sao_Paulo",

                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit"
                }
            )
            .format(
                new Date(
                    timestamp
                )
            );
    }


    function formatarQuando(
        timestamp
    ) {
        const numero =
            Number(
                timestamp || 0
            );


        if (
            !numero
        ) {
            return "";
        }


        const data =
            new Date(
                numero
            );


        const hora =
            new Intl
                .DateTimeFormat(
                    "pt-BR",
                    {
                        timeZone:
                            "America/Sao_Paulo",

                        hour:
                            "2-digit",

                        minute:
                            "2-digit"
                    }
                )
                .format(
                    data
                );


        const hoje =
            chaveData(
                Date.now()
            );


        const diaNoticia =
            chaveData(
                numero
            );


        if (
            diaNoticia ===
            hoje
        ) {
            return (
                `Hoje às ${hora}`
            );
        }


        const dataCurta =
            new Intl
                .DateTimeFormat(
                    "pt-BR",
                    {
                        timeZone:
                            "America/Sao_Paulo",

                        day:
                            "2-digit",

                        month:
                            "2-digit"
                    }
                )
                .format(
                    data
                );


        return (
            `${dataCurta} às ${hora}`
        );
    }


    // ========================================
    // CARD
    // ========================================

    function criarCard(
        noticia
    ) {
        const card =
            document.createElement(
                "article"
            );


        card.className =
            noticia.destaque
                ? "news-card news-card-destaque"
                : "news-card";


        const icone =
            document.createElement(
                "div"
            );


        icone.className =
            "news-card-icone";


        icone.textContent =
            noticia.icone ||
            "📰";


        const conteudo =
            document.createElement(
                "div"
            );


        conteudo.className =
            "news-card-conteudo";


        const titulo =
            document.createElement(
                "strong"
            );


        titulo.textContent =
            noticia.titulo ||
            "Acontecimento";


        const descricao =
            document.createElement(
                "span"
            );


        descricao.textContent =
            noticia.descricao ||
            "";


        const data =
            document.createElement(
                "small"
            );


        data.textContent =
            formatarQuando(
                noticia.criadoEm
            );


        conteudo.appendChild(
            titulo
        );


        if (
            noticia.descricao
        ) {
            conteudo.appendChild(
                descricao
            );
        }


        conteudo.appendChild(
            data
        );


        card.appendChild(
            icone
        );


        card.appendChild(
            conteudo
        );


        // ========================================
        // TOCOU NA NEWS:
        // ABRE PERFIL DA PESSOA
        // ========================================

        if (
            noticia.usuarioId &&

            typeof window
                .abrirPerfilPublico ===
            "function"
        ) {
            card.classList.add(
                "news-card-clicavel"
            );


            card.addEventListener(
                "click",
                () => {

                    window
                        .abrirPerfilPublico(
                            noticia.usuarioId
                        );
                }
            );
        }


        return card;
    }


    // ========================================
    // CARREGAR
    // ========================================

    async function carregarNews() {

        lista.replaceChildren();


        const carregando =
            document.createElement(
                "p"
            );


        carregando.className =
            "news-vazio";


        carregando.textContent =
            "Carregando...";


        lista.appendChild(
            carregando
        );


        try {

            const resposta =
                await fetch(
                    "/api/news",
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
                !resposta.ok
            ) {
                throw new Error(
                    dados.erro ||
                    "News indisponível"
                );
            }


            const noticias =
                Array.isArray(
                    dados.noticias
                )
                    ? dados.noticias
                    : [];


            lista.replaceChildren();


            if (
                noticias.length ===
                0
            ) {
                const vazio =
                    document.createElement(
                        "p"
                    );


                vazio.className =
                    "news-vazio";


                vazio.textContent =
                    "Ainda não há acontecimentos para mostrar.";


                lista.appendChild(
                    vazio
                );


                return;
            }


            for (
                const noticia
                of noticias
            ) {
                lista.appendChild(
                    criarCard(
                        noticia
                    )
                );
            }


        } catch (erro) {

            console.error(
                "❌ Erro ao carregar News:",
                erro
            );


            lista.replaceChildren();


            const falha =
                document.createElement(
                    "p"
                );


            falha.className =
                "news-vazio";


            falha.textContent =
                "❌ Não foi possível carregar as notícias.";


            lista.appendChild(
                falha
            );
        }
    }


    // ========================================
    // ABRIR
    // ========================================

    botaoNews.addEventListener(
        "click",
        () => {

            telaMenu.hidden =
                true;


            telaNews.hidden =
                false;


            carregarNews();
        }
    );


    // ========================================
    // VOLTAR
    // ========================================

    function voltarAoMenu() {

        telaNews.hidden =
            true;


        telaMenu.hidden =
            false;


        window.scrollTo({
            top: 0,
            behavior: "instant"
        });
    }

    botaoVoltar.addEventListener(
        "click",
        voltarAoMenu
    );

    botaoVoltarFlutuante.addEventListener(
        "click",
        voltarAoMenu
    );
})();