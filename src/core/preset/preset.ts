import {MockState} from '../state/mock.state';

/** Preset. */
export interface Preset {
    // the name of the preset
    name: string;
    // the mocks state
    mocks: { [name: string]: MockState; };
    // the variables state
    variables: { [key: string]: string; };
}
