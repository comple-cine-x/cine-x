import grafo as modulo_grafo
import union_find_comunidades as uf_mod

MINIMO_PELICULAS_EN_COMUN = 3


def obtener_peliculas_vistas(grafo, usuario):
    return set(grafo.neighbors(usuario))


def calcular_similitud_memo(grafo, memo, peliculas_por_usuario, usuario_a, usuario_b):
    par = (usuario_a, usuario_b) if usuario_a < usuario_b else (usuario_b, usuario_a)
    if par in memo:
        return memo[par]

    peliculas_a = peliculas_por_usuario[usuario_a]
    peliculas_b = peliculas_por_usuario[usuario_b]
    comunes = peliculas_a & peliculas_b

    if len(comunes) < MINIMO_PELICULAS_EN_COMUN:
        memo[par] = 0.0
        return 0.0

    suma_diferencias = 0.0
    for pelicula in comunes:
        rating_a = grafo[usuario_a][pelicula]["weight"]
        rating_b = grafo[usuario_b][pelicula]["weight"]
        suma_diferencias += abs(rating_a - rating_b)

    similitud = len(comunes) / (1.0 + suma_diferencias)
    memo[par] = similitud
    return similitud


def recomendar_con_pd(grafo, comunidades, usuario_id, maximo_resultados=10):
    miembros_comunidad = uf_mod.obtener_grupo_de_usuario(comunidades, usuario_id)
    vecinos_comunidad = [u for u in miembros_comunidad if u != usuario_id]

    if not vecinos_comunidad:
        return []

    memo = {}
    peliculas_por_usuario = {}
    peliculas_por_usuario[usuario_id] = obtener_peliculas_vistas(grafo, usuario_id)
    for vecino in vecinos_comunidad:
        peliculas_por_usuario[vecino] = obtener_peliculas_vistas(grafo, vecino)

    peliculas_vistas_objetivo = peliculas_por_usuario[usuario_id]
    puntaje_pelicula = {}

    for vecino in vecinos_comunidad:
        similitud = calcular_similitud_memo(grafo, memo, peliculas_por_usuario, usuario_id, vecino)
        if similitud <= 0.0:
            continue
        for pelicula in peliculas_por_usuario[vecino]:
            if pelicula in peliculas_vistas_objetivo:
                continue
            rating_vecino = grafo[vecino][pelicula]["weight"]
            aporte = similitud * rating_vecino
            if pelicula not in puntaje_pelicula:
                puntaje_pelicula[pelicula] = {"score": 0.0, "titulo": grafo.nodes[pelicula].get("titulo", "Desconocida")}
            puntaje_pelicula[pelicula]["score"] += aporte

    resultados = [
        {"id": pelicula_id, "titulo": datos["titulo"], "score": datos["score"]}
        for pelicula_id, datos in puntaje_pelicula.items()
    ]
    resultados.sort(key=lambda r: r["score"], reverse=True)

    return resultados[:maximo_resultados]


def main():
    grafo = modulo_grafo.cargar_grafo("grafo.pkl")
    comunidades = uf_mod.cargar_comunidades("comunidades.pkl")
    usuario = "U1"
    print(f"Calculando recomendaciones con Programacion Dinamica para {usuario}...")
    resultados = recomendar_con_pd(grafo, comunidades, usuario)
    if not resultados:
        print("El usuario no pertenece a ninguna comunidad con vecinos validos")
        return
    for r in resultados:
        print(f"  {r['titulo']} (score {r['score']:.2f})")


if __name__ == "__main__":
    main()
