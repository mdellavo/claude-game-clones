// UFO blueprints. Each level is an array of equal-length strings.
// Legend:
//   ' ' outside       '.' floor          '#' outer hull      '=' inner wall
//   'D' door          'P' power source   'N' navigation      'C' alien chair
//   'L' lift (bottom) 'l' lift top floor 'F' food vat        'S' surgery bed
//   'X' exam table    'R' reproduction   'T' entertainment
// Letters in the crew spec reference spawn tags: 'g' guard spots are chosen near
// consoles/power sources, the rest spawn on random interior floor.

export const UFOS = {
  small_scout: {
    name: 'Small Scout',
    size: 1, // in 10x10 map blocks
    crew: [['soldier', 1], ['navigator', 1]],
    levels: [
      [
        '  ###  ',
        ' #...# ',
        '#..N..#',
        '#.....D',
        '#..P..#',
        ' #...# ',
        '  ###  ',
      ],
    ],
  },
  medium_scout: {
    name: 'Medium Scout',
    size: 2,
    crew: [['soldier', 2], ['navigator', 1], ['leader', 1], ['soldier', 1, 0.5]],
    levels: [
      [
        '    #####    ',
        '  ##.....##  ',
        ' #..C.N.C..# ',
        ' #.........# ',
        ' D...=D=...D ',
        ' #...=P=...# ',
        ' #...===...# ',
        '  ##.....##  ',
        '    #####    ',
      ],
    ],
  },
  large_scout: {
    name: 'Large Scout',
    size: 2,
    crew: [['soldier', 3], ['navigator', 2], ['engineer', 1], ['leader', 1], ['soldier', 1, 0.5]],
    levels: [
      [
        '    #####    ',
        '  ##.....##  ',
        ' #.........# ',
        ' #..=====..# ',
        '#...=P.P=...#',
        '#...=...=...#',
        'D...D.L.D...D',
        '#...=...=...#',
        '#...=====...#',
        ' #.........# ',
        ' #....F....# ',
        '  ##.....##  ',
        '    #####    ',
      ],
      [
        '             ',
        '             ',
        '   #######   ',
        '  #.......#  ',
        '  #.C.N.C.#  ',
        '  #.......#  ',
        '  #...l...#  ',
        '  #.......#  ',
        '  #..T....#  ',
        '  #.......#  ',
        '   #######   ',
        '             ',
        '             ',
      ],
    ],
  },
  abductor: {
    name: 'Abductor',
    size: 2,
    crew: [['soldier', 4], ['navigator', 1], ['engineer', 2], ['leader', 1], ['terrorist', 2], ['soldier', 2, 0.5]],
    levels: [
      [
        '       #####       ',
        '     ##.....##     ',
        '    #..X...X..#    ',
        '    #....R....#    ',
        '    #.........#    ',
        '     ##==D==##     ',
        '  #####.....#####  ',
        ' #.....=...=.....# ',
        '#..C.N.=.L.=..F..# ',
        'D......D...D.....D ',
        '#..C...=...=..S..# ',
        ' #.....=...=.....# ',
        '  #####==P==#####  ',
        '      #.....#      ',
        '       ##D##       ',
      ],
      [
        '                   ',
        '                   ',
        '                   ',
        '                   ',
        '                   ',
        '                   ',
        '       #####       ',
        '      #.....#      ',
        '      #..l..#      ',
        '      #..P..#      ',
        '      #..T..#      ',
        '      #.....#      ',
        '       #####       ',
        '                   ',
        '                   ',
      ],
    ],
  },
};

export const RACES = {
  sectoid: { name: 'Sectoids' },
  floater: { name: 'Floaters' },
  snakeman: { name: 'Snakemen' },
  muton: { name: 'Mutons' },
};

export const TERRAINS = {
  farm: { name: 'Farmland' },
  forest: { name: 'Forest' },
  desert: { name: 'Desert' },
  arctic: { name: 'Arctic' },
};
