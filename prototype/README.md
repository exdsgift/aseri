# Prototype: hero studies (throwaway)

Question (owner, 2026-10-30): the manifesto at the top of the page, more detailed and more aesthetic than the sun. It went through three rounds:
1. A pixel eye in five variants (`eye/index.html`, https://claude.ai/artifact/GZYJHGaPHLihZP2BhCGptr). Its second version had decorated margins and a dark, surreal mood. The owner was not convinced.
2. A new direction from the owner's samples, in the style of Hermes Agent's graphics: classical engravings degraded digitally (dither, scanlines, halftone), crossed with geometric order (rays, radial ticks, checkerboards, op-art vortices), in two colours.
3. `index.html`, https://claude.ai/artifact/F3GS2LsHFaPaQMK2p7c9BX, with four studies:
   - A · Messenger
   - B · Signal
   - C · Vortex
   - D · Melancholia

Verdict (owner):
- **Messenger is adopted.** "It looks great at the highest values."
- **Signal and Vortex are kept** for later ("bellissimi").
- **Melancholia is rejected.**

Files:
- `index.html`: the built page, with the engravings inline.
- `template.html` and `build.py`: rebuild it with `python build.py template.html images index.html`.
- `images/`: the cropped engravings.

Image credits, all public domain (CC0), cropped, dithered and recoloured:
- Hendrick Goltzius after Polidoro da Caravaggio, *Mercury*, probably 1592. National Gallery of Art. https://commons.wikimedia.org/wiki/File:Hendrik_Goltzius_after_Polidoro_da_Caravaggio,_Mercury,_probably_1592,_NGA_60693.jpg
- Hendrick Goltzius, *The Farnese Hercules*, c. 1592, published 1617. The Metropolitan Museum of Art. https://commons.wikimedia.org/wiki/File:Farnese_Hercules_MET_DP102198.jpg
- *Apollo Belvedere (Apollo Pythius)*, engraving. Rijksmuseum. https://commons.wikimedia.org/wiki/File:Apollo_Belvedere_Apollo_Pythius_(titel_op_object),_RP-P-OB-102.457.jpg
- Albrecht Dürer, *Melencolia I*, 1514. The Metropolitan Museum of Art. https://commons.wikimedia.org/wiki/File:Melencolia_I_MET_DP820348.jpg
