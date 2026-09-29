/* PREENCHA OS NOMES ENTRE AS ASPAS, NA ORDEM DAS POSIÇÕES.
 * Exemplo: pontos: ["Maria", "João", "", "", "", "", ""]
 * Deixe "" nas vagas ainda sem ganhador. Não remova as posições.
 */
(() => {
    "use strict";

    const ganhadores = {
        pontos: ["Luciana Vih", "Larissa @ 𓃠", "pH", "Fernanda", "Fernanda", "Dani", "Kelvyn Herrera", "Karen", "Fernanda Dk", "C.S."], // 1º ao 10º
        media: [".........", "Laneeee", "Juliana Vantil"],                    // 1º ao 3º
        bau: ["Sabrina", "Camila A.", "May."],                      // 1º ao 3º
        diamantes: ["Luciana Vih", "Ph", "Fernanda"]                 // 1º ao 3º
    };

    function montarPodio() {
        const grade = document.querySelector("#tela-modos .grade-jogos");
        if (!grade || document.getElementById("podio-ganhadores")) return;

        const podio = document.createElement("section");
        podio.id = "podio-ganhadores";
        podio.setAttribute("aria-labelledby", "podio-titulo");

        const titulo = document.createElement("h2");
        titulo.id = "podio-titulo";
        titulo.textContent = "🏆 Pódio dos ganhadores";
        podio.appendChild(titulo);

        const descricao = document.createElement("p");
        descricao.className = "podio-descricao";
        descricao.textContent = "Os ganhadores serão anunciados aqui conforme forem definidos.";
        podio.appendChild(descricao);

        const categorias = [
            { chave: "pontos", titulo: "⭐ Pontos", vagas: 10 },
            { chave: "media", titulo: "📊 Média", vagas: 3 },
            { chave: "bau", titulo: "🎁 Baú", vagas: 3 },
            { chave: "diamantes", titulo: "💎 Diamantes", vagas: 3 }
        ];

        for (const categoria of categorias) {
            const card = document.createElement("section");
            card.className = "podio-categoria";
            const cabecalho = document.createElement("div");
            cabecalho.className = "podio-cabecalho";
            const subtitulo = document.createElement("h3");
            subtitulo.textContent = categoria.titulo;
            const contador = document.createElement("span");
            const nomes = ganhadores[categoria.chave];
            const preenchidos = nomes.slice(0, categoria.vagas).filter(nome => typeof nome === "string" && nome.trim()).length;
            contador.textContent = `${preenchidos}/${categoria.vagas}`;
            contador.setAttribute("aria-label", `${preenchidos} de ${categoria.vagas} ganhadores definidos`);
            cabecalho.append(subtitulo, contador);
            card.appendChild(cabecalho);

            const lista = document.createElement("ol");
            for (let i = 0; i < categoria.vagas; i++) {
                const nome = typeof nomes[i] === "string" ? nomes[i].trim() : "";
                const linha = document.createElement("li");
                linha.className = nome ? "podio-vaga podio-preenchida" : "podio-vaga";
                const posicao = document.createElement("span");
                posicao.className = "podio-posicao";
                posicao.textContent = ["🥇", "🥈", "🥉"][i] || `${i + 1}º`;
                posicao.setAttribute("aria-label", `${i + 1}º lugar`);
                const texto = document.createElement("span");
                texto.className = "podio-nome";
                texto.textContent = nome || "Aguardando ganhador";
                linha.append(posicao, texto);
                lista.appendChild(linha);
            }
            card.appendChild(lista);
            podio.appendChild(card);
        }
        grade.insertAdjacentElement("afterend", podio);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", montarPodio, { once: true });
    } else {
        montarPodio();
    }
})();
