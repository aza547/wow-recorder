import { specializationById } from '../main/constants';

interface ImageObject {
  [id: number]: string;
}

const specIDs = Object.keys(specializationById).map((v) => parseInt(v, 10));
const specImages: ImageObject = {
  0: require('../../assets/icon/wowNotFound.png'),
};

specIDs.forEach((id) => {
  try {
    specImages[id] = require(`../../assets/specs/${id}.png`);
  } catch (e) {
    console.error(
      `[Images] Unable to load image resource that was expected to exist.\n`,
      e
    );
  }
});

export { specImages };
