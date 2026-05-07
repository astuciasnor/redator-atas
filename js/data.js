// data.js
// Aqui podemos centralizar os dados ou buscar do github
const jsonMembrosPadrao = [
  { nome: "Carlos Alberto Martins Cordeiro", funcao: "Prof. Dr." },
  { nome: "Cleide Barbosa Marques de Sousa", funcao: "Profa. Dra." },
  { nome: "Daniel Abreu Vasconcelos Campelo", funcao: "Prof. Dr." },
  { nome: "Carlos Eduardo Rangel de Andrade", funcao: "Prof. Dr." },
  { nome: "Evaldo Martins da Silva", funcao: "Prof. Dr." },
  { nome: "Francisco C. A. Fonteles Holanda", funcao: "Prof. Dr." },
  { nome: "Grazielle Fernanda Evangelista Gomes", funcao: "Profa. Dra." },
  { nome: "Hudson Cleber Pereira da Silva", funcao: "Prof. Dr." },
  { nome: "Ivan Lucas Fernandes Matos", funcao: "Representante Discente" },
  { nome: "Ana Luiza Borges Guedes", funcao: "Representante Discente" },
  { nome: "Leonnan Carlos Carvalho de Oliveira", funcao: "Prof. Dr." },
  { nome: "Lorena Batista de Moura", funcao: "Profa. Dra." },
  { nome: "Marcos Ferreira Brabo", funcao: "Prof. Dr." },
  { nome: "Nils Edvin Asp Neto", funcao: "Prof. Dr." },
  { nome: "Pedro Andrés Chira Oliva", funcao: "Prof. Dr." },
  { nome: "Rafael Anaisce das Chagas", funcao: "Prof. Dr." },
  { nome: "Breno Portilho de Sousa Maia", funcao: "Representante dos Técnicos" },
  { nome: "Representantes de Turma", funcao: "Discentes" },
  { nome: "Roberta Sá Leitão Barboza", funcao: "Profa. Dra." },
  { nome: "Simoni Santos da Silva", funcao: "Profa. Dra." },
  { nome: "Zélia Maria Pimentel Nunes", funcao: "Profa. Dra." }
];

// Pode ser alterado depois para fazer fetch() num repositório web
async function getMembrosList() {
  return new Promise(resolve => resolve(jsonMembrosPadrao.map((membro) => ({ ...membro }))));
}
