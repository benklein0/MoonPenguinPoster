#!/usr/bin/env python3
"""One-time pass: add auto-detected 'color' and 'charm' arrays to each product
in docs/products.json, based on keyword matches in title + tags + description.
Keyword lists were built from real frequency analysis of the 194 product titles/tags.
"""
import json
import re

PRODUCTS_PATH = 'docs/products.json'

COLOR_KEYWORDS = {
    'Gold':       [r'\bgold(en)?\b'],
    'Silver':     [r'\bsilver\b'],
    'Bronze':     [r'\bbronze\b', r'\bantiqued\b'],
    'Blue':       [r'\bblue\b', r'\bnavy\b', r'\bturquoise\b'],
    'Pink':       [r'\bpink\b'],
    'Red':        [r'\bred\b'],
    'Green':      [r'\bgreen\b'],
    'Purple':     [r'\bpurple\b', r'\blavender\b', r'\bviolet\b'],
    'Black':      [r'\bblack\b'],
    'White':      [r'\bwhite\b', r'\bivory\b'],
    'Pastel':     [r'\bpastel\b'],
    'Multicolor': [r'\brainbow\b', r'\bmulti[\s-]?color(ed)?\b'],
}

CHARM_KEYWORDS = {
    'Bee':               [r'\bbee\b'],
    'Bunny & Rabbit':    [r'\bbunny\b', r'\brabbit\b'],
    'Snake':             [r'\bsnake\b', r'\bserpent\b'],
    'Butterfly':         [r'\bbutterfly\b'],
    'Angel & Cherub':    [r'\bangel\b', r'\bcherub\b', r'\bcupid\b'],
    'Lion & Zodiac':     [r'\blion\b', r'\bleo\b', r'\bzodiac\b'],
    'Fox':               [r'\bfox\b'],
    'Skull & Pirate':    [r'\bskull\b', r'\bpirate\b', r'\bjolly roger\b'],
    'Flower & Botanical':[r'\bflower(s)?\b', r'\bfloral\b', r'\bbotanical\b'],
    'Elephant':          [r'\belephant\b'],
    'Unicorn':           [r'\bunicorn\b'],
    'Moon & Celestial':  [r'\bmoon\b', r'\bcelestial\b', r'\bsun\b', r'\bstar(s)?\b'],
    'Bird':              [r'\bbird(s)?\b'],
    'Bow':               [r'\bbow\b'],
}

def find_matches(text, keyword_map):
    hits = []
    for label, patterns in keyword_map.items():
        for pat in patterns:
            if re.search(pat, text):
                hits.append(label)
                break
    return hits

def main():
    with open(PRODUCTS_PATH) as f:
        products = json.load(f)

    color_counts = {}
    charm_counts = {}
    uncategorized_charm = 0

    for p in products:
        text = ' '.join([
            p.get('title', ''),
            ' '.join(p.get('tags', [])),
            p.get('description', ''),
        ]).lower()

        colors = find_matches(text, COLOR_KEYWORDS)
        charms = find_matches(text, CHARM_KEYWORDS)

        p['color'] = colors
        p['charm'] = charms

        for c in colors:
            color_counts[c] = color_counts.get(c, 0) + 1
        for c in charms:
            charm_counts[c] = charm_counts.get(c, 0) + 1
        if not charms:
            uncategorized_charm += 1

    with open(PRODUCTS_PATH, 'w') as f:
        json.dump(products, f, indent=2)
        f.write('\n')

    print(f'{len(products)} products tagged')
    print('Color distribution:', dict(sorted(color_counts.items(), key=lambda x: -x[1])))
    print('Charm distribution:', dict(sorted(charm_counts.items(), key=lambda x: -x[1])))
    print('Products with no charm match:', uncategorized_charm)

if __name__ == '__main__':
    main()
