-- Banco separado só para os testes automatizados. Nunca guarda dado real:
-- os testes truncam essas tabelas a cada execução. O banco principal
-- (mercurio) é o único que recebe dado real do Pluggy.
CREATE DATABASE mercurio_test;
