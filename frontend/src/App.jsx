import React from "react";
import Chatbot from "./components/Chatbot";
import "./App.css";

export default function App() {
  return (
    <div className="app-container raleway">
      <h1 className="wdxl-lubrifont-sc-regular raleway-700 mb-5 rag-h1">
        Retrieval Augmented Generation - Chatbot Customizável
      </h1>
      <Chatbot />
      <footer className="app-footer raleway-300">
        <p>
          © 2025 — Aplicação desenvolvida por Caio Municelli, Lorenzo Messias,
          Luiz de Souza e Ricardo Duarte, com orientação de Gabriel Lara, para o
          curso de Engenharia de Computação da Faculdade Engenheiro Salvador
          Arena. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
