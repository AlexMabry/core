import 'reflect-metadata';
import {Container} from 'inversify';

import * as sinon from 'sinon';

import MocksState from './mocks.state';
import SessionState from './session.state';
import State from './state';

describe('MocksState', () => {
    let container: Container;
    let mocksState: MocksState;
    let mocksStateGetMatchingStateFn: sinon.SinonStub;

    beforeAll(() => {
        container = new Container();
        mocksState = new MocksState();
        mocksStateGetMatchingStateFn = sinon.stub(MocksState.prototype, <any>'getMatchingState');
        mocksState.mocks = [{
            name: 'simple', request: { url: 'some/api', method: 'GET', }, responses: { one: {}, two: {} }
        }, {
            name: 'advanced', request: {
                url: 'some/api', method: 'POST',
                headers: { 'Content-Type': '.*/json', 'Cache-Control': 'no-cache' },
                body: { number: '\\d+', identifier: '^[a-zA-Z]{4}$' }
            }, responses: { three: {}, four: {} }
        }];
    });

    describe('getMatchingState', () => {
        beforeEach(() => {
            mocksState.global.mocks['some'] = { scenario: 'thing', echo: true, delay: 0 };
            mocksState.global.variables['some'] = 'some';
            mocksState.sessions = [];
            mocksStateGetMatchingStateFn.callThrough();
        });

        describe('id === undefined', () =>
            it('returns the global mocksState', () =>
                expect(mocksState.getMatchingState(undefined)).toBe(mocksState.global)));

        describe('no session matching the id', () =>
            it('returns a new SessionState by cloning the GlobalState', () => {
                const matchingState = mocksState.getMatchingState('someId');
                expect(mocksState.sessions.length).toBe(1);

                expect((matchingState as SessionState).identifier).toBe('someId');
                expect(Object.keys(matchingState.mocks).length).toBe(1);
                expect(matchingState.mocks['some']).toEqual({ scenario: 'thing', echo: true, delay: 0 });
                expect(Object.keys(matchingState.variables).length).toBe(1);
                expect(matchingState.variables['some']).toBe('some');
            })
        );

        describe('session matches the id', () => {
            let sessionState: SessionState;
            beforeEach(() => {
                sessionState = new SessionState('someId');
                mocksState.sessions.push(sessionState);
            });
            it('returns the matching SessionState', () => {
                const matchingState = mocksState.getMatchingState('someId');
                expect(mocksState.sessions.length).toBe(1);
                expect(matchingState).toBe(sessionState);
            });
        });

        afterEach(() => {
            mocksStateGetMatchingStateFn.reset();
        });
    });

    describe('getMatchingMock', () => {
        describe('url does not match', () =>
            it('returns undefined', () =>
                expect(mocksState.getMatchingMock('no/match', 'P2OST', {
                    'content-type': 'application/json',
                    'cache-control': 'no-cache'
                }, { number: 123, identifier: 'abcd' })).toBeUndefined()));

        describe('method does not match', () =>
            it('returns undefined', () =>
                expect(mocksState.getMatchingMock('some/api', 'PUT', {
                    'content-type': 'application/json',
                    'cache-control': 'no-cache'
                }, { number: 123, identifier: 'abcd' })).toBeUndefined()));

        describe('headers does not match', () =>
            it('returns undefined', () =>
                expect(mocksState.getMatchingMock('some/api', 'POST', {
                    'content-type': 'application/json',
                    'cache-control': 'public'
                }, { number: 123, identifier: 'abcd' })).toBeUndefined()));

        describe('body does not match', () =>
            it('returns undefined', () =>
                expect(mocksState.getMatchingMock('some/api', 'POST', {
                    'content-type': 'application/json',
                    'cache-control': 'no-cache'
                }, { number: 123, identifier: 'ab' })).toBeUndefined()));

        describe('request matches', () =>
            it('returns the matching mock', () => {
                // match simple mock - only url and method
                expect(mocksState.getMatchingMock('some/api', 'GET', {}, {})).toEqual({
                    name: 'simple', request: { url: 'some/api', method: 'GET', }, responses: { one: {}, two: {} }
                });
                // match advanced mock - url, method, headers, body
                expect(mocksState.getMatchingMock('some/api', 'POST', {
                    'content-type': 'application/json',
                    'cache-control': 'no-cache'
                }, { number: 123, identifier: 'abcd' })).toEqual({
                    name: 'advanced', request: {
                        url: 'some/api', method: 'POST',
                        headers: { 'Content-Type': '.*/json', 'Cache-Control': 'no-cache' },
                        body: { number: '\\d+', identifier: '^[a-zA-Z]{4}$' }
                    }, responses: { three: {}, four: {} }
                });
            }));
    });

    describe('getResponse', () => {
        let state: State;
        beforeEach(() => {
            state = {
                mocks: { simple: { scenario: 'one', delay: 0, echo: false } },
                variables: {}
            };
            mocksStateGetMatchingStateFn.returns(state);
        });

        describe('no matching mock', () =>
            it('returns undefined', () =>
                expect(mocksState.getResponse('noMatch', 'id')).toBeUndefined()));

        describe('matching mock', () =>
            it('returns the selected response', () =>
                expect(mocksState.getResponse('simple', 'id')).toEqual({
                    name: 'simple', request: { url: 'some/api', method: 'GET', }, responses: { one: {}, two: {} }
                }.responses['one'])));

        afterEach(() => {
            mocksStateGetMatchingStateFn.reset();
        });
    });

    describe('getDelay', () => {
        let state: State;
        beforeEach(() => {
            state = {
                mocks: { simple: { scenario: 'one', delay: 1000, echo: false } },
                variables: {}
            };
            mocksStateGetMatchingStateFn.returns(state);
        });

        describe('no matching mock', () =>
            it('returns 0', () =>
                expect(mocksState.getDelay('noMatch', 'id')).toBe(0)));

        describe('matching mock', () =>
            it('returns the selected delay', () =>
                expect(mocksState.getDelay('simple', 'id')).toBe(1000)));

        afterEach(() => {
            mocksStateGetMatchingStateFn.reset();
        });
    });

    describe('getEcho', () => {
        let state: State;
        beforeEach(() => {
            state = {
                mocks: { simple: { scenario: 'one', delay: 1000, echo: true } },
                variables: {}
            };
            mocksStateGetMatchingStateFn.returns(state);
        });

        describe('no matching mock', () =>
            it('returns false', () =>
                expect(mocksState.getEcho('noMatch', 'id')).toBe(false)));

        describe('matching mock', () =>
            it('returns the selected echo', () =>
                expect(mocksState.getEcho('simple', 'id')).toBe(true)));

        afterEach(() => {
            mocksStateGetMatchingStateFn.reset();
        });
    });

    describe('getVariables', () => {
        let state: State;
        beforeEach(() => {
            state = {
                mocks: {},
                variables: { this: 'this', that: 'that' }
            };
            mocksStateGetMatchingStateFn.returns(state);
        });

        it('returns the state variables', () => {
            const response = mocksState.getVariables('id');
            expect(response).toBe(state.variables);
        });

        afterEach(() => {
            mocksStateGetMatchingStateFn.reset();
        });
    });

    describe('setToDefaults', () => {
        let state: State;
        beforeEach(() => {
            state = {
                mocks: {
                    simple: { scenario: 'one', delay: 1000, echo: true },
                    advanced: { scenario: 'three', delay: 3000, echo: false }
                },
                variables: {}
            };

            mocksState.defaults['simple'] = { scenario: 'two', delay: 2000, echo: false };
            mocksState.defaults['advanced'] = { scenario: 'four', delay: 4000, echo: true };
        });

        it('sets the state to defaults', () => {
            mocksStateGetMatchingStateFn.returns(state);
            let simpleMockState = state.mocks['simple'];
            expect(simpleMockState.scenario).toBe('one');
            expect(simpleMockState.delay).toBeTruthy(1000);
            expect(simpleMockState.echo).toBe(true);

            let advancedMockState = state.mocks['advanced'];
            expect(advancedMockState.scenario).toBe('three');
            expect(advancedMockState.delay).toBeTruthy(3000);
            expect(advancedMockState.echo).toBe(false);

            mocksState.setToDefaults('id');

            simpleMockState = state.mocks['simple'];
            expect(simpleMockState.scenario).toBe('two');
            expect(simpleMockState.delay).toBeTruthy(2000);
            expect(simpleMockState.echo).toBe(false);

            advancedMockState = state.mocks['advanced'];
            expect(advancedMockState.scenario).toBe('four');
            expect(advancedMockState.delay).toBeTruthy(4000);
            expect(advancedMockState.echo).toBe(true);
        });

        afterEach(() => {
            mocksStateGetMatchingStateFn.reset();
        });
    });

    describe('setToPassThroughs', () => {
        let state: State;
        beforeEach(() => {
            state = {
                mocks: {
                    simple: { scenario: 'one', delay: 1000, echo: true },
                    advanced: { scenario: 'three', delay: 3000, echo: false }
                },
                variables: {}
            };

            mocksState.defaults['simple'] = { scenario: 'two', delay: 2000, echo: false };
            mocksState.defaults['advanced'] = { scenario: 'four', delay: 4000, echo: true };
        });

        it('sets the state to defaults', () => {
            mocksStateGetMatchingStateFn.returns(state);
            let simpleMockState = state.mocks['simple'];
            expect(simpleMockState.scenario).toBe('one');
            expect(simpleMockState.delay).toBeTruthy(1000);
            expect(simpleMockState.echo).toBe(true);

            let advancedMockState = state.mocks['advanced'];
            expect(advancedMockState.scenario).toBe('three');
            expect(advancedMockState.delay).toBeTruthy(3000);
            expect(advancedMockState.echo).toBe(false);

            mocksState.setToPassThroughs('id');

            simpleMockState = state.mocks['simple'];
            expect(simpleMockState.scenario).toBe('passThrough');
            expect(simpleMockState.delay).toBeTruthy(1000);
            expect(simpleMockState.echo).toBe(true);

            advancedMockState = state.mocks['advanced'];
            expect(advancedMockState.scenario).toBe('passThrough');
            expect(advancedMockState.delay).toBeTruthy(3000);
            expect(advancedMockState.echo).toBe(false);
        });

        afterEach(() => {
            mocksStateGetMatchingStateFn.reset();
        });
    });
});
