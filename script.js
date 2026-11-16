// URL base da PokéAPI (gratuita, sem token)
const API = "https://pokeapi.co/api/v2/pokemon";
const POR_PAGINA = 24;

const TIPOS = {
  normal: "Normal", fire: "Fogo", water: "Água", grass: "Planta",
  electric: "Elétrico", ice: "Gelo", fighting: "Lutador", poison: "Veneno",
  ground: "Terra", flying: "Voador", psychic: "Psíquico", bug: "Inseto",
  rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio",
  steel: "Aço", fairy: "Fada"
};

const $ = (id) => document.getElementById(id);
const cardsEl = $("cards");
const statusEl = $("status");
const btnMais = $("btnMais");

const cache = {};        // detalhes já buscados, para não repetir requisições
let lista = [];          // nomes dos 151 Pokémon
let filtrada = [];       // nomes que passam na busca / filtro de favoritos
let mostrados = 0;       // quantos da lista filtrada já viraram card
let soFavoritos = false;
let versao = 0;          // evita que uma busca antiga desenhe cards depois da nova
let favoritos = lerFavoritos();

/* ---------- Favoritos (guardados no navegador) ---------- */
function lerFavoritos() {
  try {
    return JSON.parse(localStorage.getItem("favoritos")) || [];
  } catch {
    return [];
  }
}

function salvarFavoritos() {
  localStorage.setItem("favoritos", JSON.stringify(favoritos));
  $("qtdFav").textContent = favoritos.length;
}

/* ---------- Consumo da API com fetch ---------- */
async function iniciar() {
  salvarFavoritos();
  statusEl.textContent = "Carregando Pokémon...";
  try {
    const resposta = await fetch(`${API}?limit=151`);
    if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
    const dados = await resposta.json();
    lista = dados.results.map((p) => p.name);
    aplicarFiltro();
  } catch (erro) {
    console.error(erro);
    statusEl.textContent = "Não foi possível carregar a PokéAPI. Verifique sua internet e recarregue a página.";
  }
}

async function buscarPokemon(nome) {
  if (cache[nome]) return cache[nome];
  const resposta = await fetch(`${API}/${nome}`);
  if (!resposta.ok) throw new Error(`Erro ${resposta.status} ao buscar ${nome}`);
  cache[nome] = await resposta.json();
  return cache[nome];
}

/* ---------- Lista, busca e paginação ---------- */
function aplicarFiltro() {
  versao++;
  const termo = $("busca").value.trim().toLowerCase();
  filtrada = lista.filter(
    (nome) => nome.includes(termo) && (!soFavoritos || favoritos.includes(nome))
  );
  cardsEl.replaceChildren();
  mostrados = 0;

  if (filtrada.length === 0) {
    statusEl.textContent = soFavoritos && !termo
      ? "Você ainda não tem favoritos. Clique no coração de um card para salvar."
      : "Nenhum Pokémon encontrado com esse nome.";
    btnMais.hidden = true;
    return;
  }
  mostrarMais();
}

async function mostrarMais() {
  const minhaVersao = versao;
  const lote = filtrada.slice(mostrados, mostrados + POR_PAGINA);
  btnMais.disabled = true;
  statusEl.textContent = "Carregando...";

  try {
    const pokemons = await Promise.all(lote.map(buscarPokemon));
    if (minhaVersao !== versao) return;   // a busca mudou enquanto carregava

    // Cada card é criado aqui, pelo JavaScript, e encaixado na página com appendChild
    pokemons.forEach((p) => cardsEl.appendChild(criarCard(p)));
    mostrados += lote.length;
    statusEl.textContent = `Mostrando ${mostrados} de ${filtrada.length} Pokémon`;
  } catch (erro) {
    console.error(erro);
    statusEl.textContent = "Erro ao carregar os Pokémon. Tente novamente.";
  }
  btnMais.disabled = false;
  btnMais.hidden = mostrados >= filtrada.length;
}

/* ---------- Criação do card (manipulação do DOM) ---------- */
function stat(p, nome) {
  return p.stats.find((s) => s.stat.name === nome).base_stat;
}

function criarLinha(rotulo, valor) {
  const dt = document.createElement("dt");
  dt.textContent = rotulo;
  const dd = document.createElement("dd");
  dd.textContent = valor;
  return [dt, dd];
}

function pintarFavorito(botao, ativo) {
  botao.textContent = ativo ? "♥" : "♡";
  botao.setAttribute("aria-pressed", ativo);
  botao.setAttribute("aria-label", ativo ? "Remover dos favoritos" : "Adicionar aos favoritos");
}

function alternarFavorito(nome, botao) {
  const posicao = favoritos.indexOf(nome);
  if (posicao >= 0) favoritos.splice(posicao, 1);
  else favoritos.push(nome);
  salvarFavoritos();
  pintarFavorito(botao, posicao < 0);
  if (soFavoritos && posicao >= 0) aplicarFiltro();   // saiu dos favoritos: atualiza a lista
}

function criarCard(p) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.tipo = p.types[0].type.name;

  const titulo = document.createElement("h2");
  titulo.textContent = p.name;

  const numero = document.createElement("div");
  numero.className = "card__num";
  numero.textContent = `#${String(p.id).padStart(3, "0")}`;

  const favorito = document.createElement("button");
  favorito.type = "button";
  favorito.className = "card__fav";
  pintarFavorito(favorito, favoritos.includes(p.name));
  favorito.addEventListener("click", () => alternarFavorito(p.name, favorito));

  const moldura = document.createElement("div");
  moldura.className = "card__img";
  const imagem = document.createElement("img");
  imagem.src = p.sprites.other["official-artwork"].front_default || p.sprites.front_default;
  imagem.alt = `Ilustração de ${p.name}`;
  imagem.loading = "lazy";
  moldura.appendChild(imagem);

  const tipos = document.createElement("ul");
  tipos.className = "tipos";
  p.types.forEach((t) => {
    const item = document.createElement("li");
    item.className = "tipo";
    item.dataset.tipo = t.type.name;
    item.textContent = TIPOS[t.type.name] || t.type.name;
    tipos.appendChild(item);
  });

  const dados = document.createElement("dl");
  dados.className = "dados";
  dados.append(
    ...criarLinha("HP", stat(p, "hp")),
    ...criarLinha("Ataque", stat(p, "attack")),
    ...criarLinha("Defesa", stat(p, "defense")),
    ...criarLinha("Altura", `${(p.height / 10).toLocaleString("pt-BR")} m`),
    ...criarLinha("Peso", `${(p.weight / 10).toLocaleString("pt-BR")} kg`)
  );

  card.append(favorito, titulo, numero, moldura, tipos, dados);
  return card;
}

/* ---------- Eventos ---------- */
let espera;
$("busca").addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(aplicarFiltro, 250);   // espera o usuário parar de digitar
});

$("btnFavoritos").addEventListener("click", (e) => {
  soFavoritos = !soFavoritos;
  e.currentTarget.setAttribute("aria-pressed", soFavoritos);
  aplicarFiltro();
});

btnMais.addEventListener("click", mostrarMais);

iniciar();
