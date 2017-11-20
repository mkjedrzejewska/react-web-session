import React from 'react';
import { mount } from 'enzyme';
import lolex from 'lolex';

import ReactWebSession, { updateSession } from '../src/index';

jest.mock('history/createBrowserHistory', () => {
  const history = require.requireActual('history');

  return history.createMemoryHistory;
});

const setLocation = ({ hash = '', pathname = '/', search = '' } = {}) => {
  window.location.hash = hash;
  window.location.pathname = pathname;
  window.location.search = search;
};

const getSession = () => JSON.parse(localStorage.getItem('WebSessionData'));

const mockCallback = jest.fn();

const props = {
  callback: mockCallback,
};

const setup = (ownProps = props) =>
  mount(
    <ReactWebSession {...ownProps} />,
    { attachTo: document.getElementById('react') }
  );

describe('ReactWebSession', () => {
  let wrapper;
  let clock;

  beforeAll(() => {
    localStorage.clear();

    clock = lolex.install({
      now: new Date('1999-12-31 23:15:00'),
    });
  });

  afterAll(() => {
    lolex.uninstall();
    wrapper.unmount();
  });

  describe('a brand new session', () => {
    beforeAll(() => {
      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should start a new session', () => {
      const session = getSession();
      expect(session.visits).toBe(1);

      expect(mockCallback).lastCalledWith(session);
      expect(session.origin.pathname).toBe('/');
    });

    it('should handle history changes', () => {
      const storage = getSession();
      clock.tick('15');

      wrapper.instance().props.history.push('/a');
      const freshStorage = getSession();

      expect(mockCallback).lastCalledWith(freshStorage);
      expect(storage.current.expiresAt !== freshStorage.current.expiresAt).toBe(true);
    });

    it('should call webSession.update() and extend the session', () => {
      const storage = getSession();
      clock.tick('15');

      updateSession();
      const freshStorage = getSession();
      expect(mockCallback).lastCalledWith(freshStorage);
      expect(storage.current.expiresAt !== freshStorage.current.expiresAt).toBe(true);
    });
  });

  describe('a new visit after 05 minutes', () => {
    beforeAll(() => {
      clock.tick('05:00');
      setLocation({ pathname: '/b' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should still be in the same session', () => {
      const session = getSession();

      expect(session.visits).toBe(1);
      expect(session.current.pathname).toBe('/');
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('another visit after 30 minutes', () => {
    beforeAll(() => {
      clock.tick('31:00');
      setLocation({ pathname: '/c' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should have started a new session', () => {
      const session = getSession();

      expect(session.visits).toBe(2);
      expect(session.current.pathname).toBe('/c');
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('a new visit after 10 minutes but it\'s a new day', () => {
    beforeAll(() => {
      clock.tick('10:00');
      setLocation({ pathname: '/e' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should have started a new session', () => {
      const session = getSession();

      expect(session.visits).toBe(3);
      expect(session.current.pathname).toBe('/e');
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('10 minutes after the last visit', () => {
    beforeAll(() => {
      clock.tick('10:00');
      setLocation({ pathname: '/g' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should still be in the same session', () => {
      const session = getSession();

      expect(session.visits).toBe(3);
      expect(session.current.pathname).toBe('/e');
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('another visit after 10 minutes but it has a new campaign', () => {
    beforeAll(() => {
      clock.tick('10:00');
      setLocation({ pathname: '/cpc', search: '?utm_source=cpc' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should have started a new session', () => {
      const session = getSession();

      expect(session.visits).toBe(4);
      expect(session.current.pathname).toBe('/cpc');
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('just 5 minutes after the last but no campaign', () => {
    beforeAll(() => {
      clock.tick('05:00');
      setLocation({ pathname: '/about', search: '' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should still be in the same session', () => {
      const session = getSession();

      expect(session.visits).toBe(4);
      expect(session.current.pathname).toBe('/cpc');
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('another 10 minutes but a new campaign', () => {
    beforeAll(() => {
      clock.tick('10:00');
      setLocation({ pathname: '/affiliate', search: '?utm_source=affiliate' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should have started a new session', () => {
      const session = getSession();

      expect(session.visits).toBe(5);
      expect(session.current.pathname).toBe('/affiliate');
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('another 60 minutes', () => {
    beforeAll(() => {
      clock.tick('01:00:00');
      setLocation();

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should have started a new session', () => {
      const session = getSession();

      expect(session.visits).toBe(6);
      expect(session.current.pathname).toBe('/');
      expect(session.current.campaign).toEqual({ source: 'affiliate' });
      expect(mockCallback).lastCalledWith(session);
    });
  });

  describe('with AdWords query', () => {
    beforeAll(() => {
      clock.tick('10:00');
      setLocation({ pathname: '/products/1234', search: '?gclid=3097hds92ghsd775sg72sg256rs2s35d3' });

      wrapper = setup();
      wrapper.instance().props.history.listen(setLocation);
    });

    it('should have started a new session', () => {
      const session = getSession();

      expect(session.visits).toBe(7);
      expect(session.current.pathname).toBe('/products/1234');
      expect(session.current.campaign).toEqual({ gclid: '3097hds92ghsd775sg72sg256rs2s35d3' });
      expect(mockCallback).lastCalledWith(session);
    });
  });
});
