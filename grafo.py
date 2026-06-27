import csv
import pickle
import networkx as nx

RUTA_RATINGS = "ml-25m/ratings.csv"
RUTA_MOVIES = "ml-25m/movies.csv"
RUTA_GRAFO_GUARDADO = "grafo.pkl"

MIN_VALORACIONES_POR_PELICULA = 500


def cargar_titulos_peliculas(ruta_movies):
    titulos = {}
    with open(ruta_movies, "r", encoding="utf-8") as archivo:
        lector = csv.DictReader(archivo)
        for fila in lector:
            titulos[fila["movieId"]] = fila["title"]
    return titulos


def contar_valoraciones_por_pelicula(ruta_ratings):
    conteo = {}
    with open(ruta_ratings, "r", encoding="utf-8") as archivo:
        lector = csv.DictReader(archivo)
        for fila in lector:
            movie_id = fila["movieId"]
            conteo[movie_id] = conteo.get(movie_id, 0) + 1
    return conteo


def construir_grafo(ruta_ratings, titulos_peliculas, conteo_valoraciones):
    grafo = nx.Graph()
    peliculas_aceptadas = {
        movie_id
        for movie_id, cantidad in conteo_valoraciones.items()
        if cantidad >= MIN_VALORACIONES_POR_PELICULA
    }

    with open(ruta_ratings, "r", encoding="utf-8") as archivo:
        lector = csv.DictReader(archivo)

        LIMITE = 200000  

        for i, fila in enumerate(lector):
            if i >= LIMITE:
                break

            movie_id = fila["movieId"]
            if movie_id not in peliculas_aceptadas:
                continue

            user_id = fila["userId"]
            rating = float(fila["rating"])

            nodo_usuario = "U" + user_id
            nodo_pelicula = "M" + movie_id

            grafo.add_node(nodo_usuario, tipo="usuario")
            grafo.add_node(
                nodo_pelicula,
                tipo="pelicula",
                titulo=titulos_peliculas.get(movie_id, "Desconocida"),
            )

            grafo.add_edge(nodo_usuario, nodo_pelicula, weight=rating)

    return grafo


def guardar_grafo(grafo, ruta_destino):
    with open(ruta_destino, "wb") as archivo:
        pickle.dump(grafo, archivo)


def cargar_grafo(ruta_origen):
    with open(ruta_origen, "rb") as archivo:
        return pickle.load(archivo)


def main():
    print("Cargando titulos de peliculas...")
    titulos_peliculas = cargar_titulos_peliculas(RUTA_MOVIES)

    print("Contando valoraciones por pelicula...")
    conteo_valoraciones = contar_valoraciones_por_pelicula(RUTA_RATINGS)

    print(f"Construyendo grafo (filtro: >= {MIN_VALORACIONES_POR_PELICULA} valoraciones)...")
    grafo = construir_grafo(RUTA_RATINGS, titulos_peliculas, conteo_valoraciones)

    nodos_usuario = [n for n, d in grafo.nodes(data=True) if d.get("tipo") == "usuario"]
    nodos_pelicula = [n for n, d in grafo.nodes(data=True) if d.get("tipo") == "pelicula"]

    print()
    print("Resumen del grafo construido:")
    print(f"  Usuarios:  {len(nodos_usuario)}")
    print(f"  Peliculas: {len(nodos_pelicula)}")
    print(f"  Nodos totales: {grafo.number_of_nodes()}")
    print(f"  Aristas (valoraciones): {grafo.number_of_edges()}")

    usuarios = [n for n, d in grafo.nodes(data=True) if d.get("tipo") == "usuario"]

    print("Primeros 20 usuarios:")
    print(usuarios[:20])

    print()
    print(f"Guardando grafo en {RUTA_GRAFO_GUARDADO}...")
    guardar_grafo(grafo, RUTA_GRAFO_GUARDADO)
    print("Listo.")

    return grafo


if __name__ == "__main__":
    main()
