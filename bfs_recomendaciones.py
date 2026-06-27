from collections import deque

import grafo as modulo_grafo


def bfs_recomendaciones(grafo, usuario_inicial, saltos_maximos=4):
    visitados = set()
    cola = deque()
    cola.append((usuario_inicial, 0))
    visitados.add(usuario_inicial)

    peliculas_vistas = set()
    for vecino in grafo.neighbors(usuario_inicial):
        peliculas_vistas.add(vecino)

    recomendaciones = []

    while cola:
        nodo_actual, distancia = cola.popleft()

        if distancia >= saltos_maximos:
            continue

        for vecino in grafo.neighbors(nodo_actual):
            if vecino in visitados:
                continue

            visitados.add(vecino)
            cola.append((vecino, distancia + 1))

            es_pelicula = grafo.nodes[vecino].get("tipo") == "pelicula"
            if es_pelicula and vecino not in peliculas_vistas:
                recomendaciones.append(
                    {
                        "id": vecino,
                        "titulo": grafo.nodes[vecino].get("titulo", "Desconocida"),
                        "distancia": distancia + 1,
                    }
                )

    return recomendaciones


def main():
    grafo = modulo_grafo.cargar_grafo("grafo.pkl")
    usuario = "U1"

    print(f"Buscando recomendaciones para {usuario} con BFS...")
    recomendaciones = bfs_recomendaciones(grafo, usuario)

    for r in recomendaciones:
        print(f"  {r['titulo']} (distancia {r['distancia']})")


if __name__ == "__main__":
    main()
