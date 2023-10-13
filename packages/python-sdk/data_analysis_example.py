import logging
from os import getenv

from dotenv import load_dotenv

from e2b.templates.data_analysis import DataAnalysis

load_dotenv()
E2B_API_KEY = getenv("E2B_API_KEY")

logging.basicConfig(level=logging.ERROR)


def main():
    s = DataAnalysis(api_key=E2B_API_KEY)

    with open("data/spotify-2023.csv", "rb") as f:
        s.upload_file(file=f)

    stdout, stderr, artifacts = s.run_python(
        """
import numpy as np # linear algebra
import pandas as pd # data processing, CSV file I/O (e.g. pd.read_csv)
import matplotlib.pyplot as plt
import seaborn as sns

spotify_filepath = '/root/spotify-2023.csv'

spotify_data = pd.read_csv(spotify_filepath, encoding='latin')

# Artists with most songs in the top 10 / Artistas con más canciones en el top 10
top_artists_per_song = spotify_data['artist(s)_name'].value_counts().head(10)
top_artists_per_song

plt.figure(figsize=(13, 6))
sns.barplot(x=top_artists_per_song.index, y=top_artists_per_song.values, palette='crest_r')
plt.ylabel('Número de Canciones',fontsize=10)
plt.xlabel('Nombre del Artista',fontsize=10)
plt.title('Artistas con más canciones en el top 10')
plt.xticks(fontsize=9)

plt.show()
"""
    )

    for artifact in artifacts:
        content = artifact.read()
        with open(artifact.name, "wb") as f:
            f.write(content)

    s.close()


if __name__ == "__main__":
    main()
