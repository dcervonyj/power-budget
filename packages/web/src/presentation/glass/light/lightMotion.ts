const REVEAL_EASING = 'cubic-bezier(.22,.9,.3,1)';

export interface BeamAnimations {
  readonly beam: string | undefined;
  readonly spark: string | undefined;
}

export interface LensAnimations {
  readonly core: string | undefined;
  readonly bloom: string | undefined;
  readonly caustic: string | undefined;
  readonly film: string | undefined;
  readonly twinkles: readonly (string | undefined)[];
}

const TWINKLES: readonly string[] = [
  'd7-twinkle 2.8s ease-in-out .4s infinite',
  'd7-twinkle 3.4s ease-in-out 1.3s infinite',
  'd7-twinkle 3.1s ease-in-out 2.1s infinite',
];

/** Decorative loops only: with reduced motion nothing is attached and the light shows at full length. */
export function beamAnimations(
  reducedMotion: boolean,
  vertical: boolean,
  delay: string,
  loopDelay: string,
): BeamAnimations {
  if (reducedMotion) {
    return { beam: undefined, spark: undefined };
  }
  const reveal = vertical ? 'd7-reveal-v' : 'd7-reveal';
  const travel = vertical ? 'd7-rise-v' : 'd7-travel';

  return {
    beam: `${reveal} 700ms ${REVEAL_EASING} ${delay} backwards, d7-flicker 4.2s ease-in-out ${loopDelay} infinite`,
    spark: `${travel} 3.4s ease-in-out ${loopDelay} infinite`,
  };
}

export function lensAnimations(reducedMotion: boolean): LensAnimations {
  if (reducedMotion) {
    return {
      core: undefined,
      bloom: undefined,
      caustic: undefined,
      film: undefined,
      twinkles: TWINKLES.map(none),
    };
  }

  return {
    core: `d7-glowin 700ms ${REVEAL_EASING} 300ms backwards, d7-flicker 5s ease-in-out 1.2s infinite`,
    bloom: 'd7-bloom 4.8s ease-in-out infinite alternate',
    caustic: 'd7-caustic 7s ease-in-out infinite alternate',
    film: 'd7-film 14s ease-in-out infinite alternate',
    twinkles: TWINKLES,
  };
}

function none(): undefined {
  return undefined;
}
