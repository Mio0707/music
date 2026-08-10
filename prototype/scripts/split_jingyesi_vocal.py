from pathlib import Path
import wave


SOURCE = Path(__file__).parents[1] / "assets" / "music" / "poetry" / "jingyesi" / "rabbit-vocal.wav"
OUTPUT_DIR = SOURCE.parent / "lines"
LINE_COUNT = 4


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with wave.open(str(SOURCE), "rb") as source:
        params = source.getparams()
        frame_count = source.getnframes()
        frames = source.readframes(frame_count)

    bytes_per_frame = params.nchannels * params.sampwidth
    for index in range(LINE_COUNT):
        start_frame = round(frame_count * index / LINE_COUNT)
        end_frame = round(frame_count * (index + 1) / LINE_COUNT)
        clip = frames[start_frame * bytes_per_frame:end_frame * bytes_per_frame]
        output = OUTPUT_DIR / f"line-{index + 1}.wav"
        with wave.open(str(output), "wb") as target:
            target.setparams(params)
            target.writeframes(clip)
        print(f"{output.name}: {(end_frame - start_frame) / params.framerate:.3f}s")


if __name__ == "__main__":
    main()
