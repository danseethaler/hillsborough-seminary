import React from 'react';
import styled from 'react-emotion';
import {getNextClass} from '../services/schedule';
import LessonCard from './LessonCard';
import {Switch, Route} from 'react-router-dom';
import Schedule from '../pages/schedule';

const Wrapper = styled.div(({theme}) => ({
  paddingLeft: 30,
  paddingRight: 30,
  paddingBottom: 30,
}));

export const Title = styled.h1(({theme, type = 'primary'}) => ({
  color: theme.colors.text[type],
  fontFamily: "'Roboto', sans-serif",
  fontWeight: 300,
  fontSize: '1.8em',
}));

const Circle = styled.div(({theme}) => ({
  background: 'radial-gradient(circle at center, transparent 47%, #ef0b18 47%)',
  position: 'fixed',
  top: -50,
  right: -50,
  opacity: 0.2,
  borderRadius: 100,
  height: 190,
  width: 190,
}));

const nextClass = getNextClass();

export default ({title, children}) => (
  <Wrapper>
    <Circle />
    <Switch>
      <Route
        exact
        path="/"
        render={() => (
          <React.Fragment>
            <Title>{nextClass.dayName}</Title>
            <LessonCard {...nextClass} />
          </React.Fragment>
        )}
      />
      <Route
        exact
        path="/schedule"
        render={() => (
          <React.Fragment>
            <Title>Schedule</Title>
            <Schedule />
          </React.Fragment>
        )}
      />
    </Switch>
    {children}
  </Wrapper>
);
