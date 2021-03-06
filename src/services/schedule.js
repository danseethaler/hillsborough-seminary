import moment from 'moment';
import {getAllData} from '../airtable';
import {typesWithNoClass, tables} from '../constants';
import dac from '../data/dac';
import assignment from './assignment';

const SCHEDULE_VERSION = '0.0.2';

const transformData = datasets => {
  datasets.teachers = datasets.teachers.map(({name}) => name);

  datasets.students = datasets.students
    .filter(({name}) => name)
    .map(({name}) => name);

  return datasets;
};

const classWeeks = [];

const getTeacher = (date, type, teachers) => {
  // If there's no class return null
  if (typesWithNoClass.includes(type)) return null;

  // Set the week index
  const week = moment(date).week();
  const year = moment(date).year();
  let weekYear = `${week}_${year}`;

  // Setup the first week so we don't push the first
  // teacher to the end
  if (classWeeks.length === 0) {
    classWeeks.push(weekYear);
  }

  // If this is a new week
  if (!classWeeks.includes(weekYear)) {
    classWeeks.push(weekYear);
    // Move the current teacher to end of the array
    teachers.push(teachers.shift());
  }

  return teachers[0];
};

const setupLessons = (dates, lessons) => {
  let lessonIndex = -1;
  return dateIndex => {
    lessonIndex++;

    if (!dates[dateIndex]) return null;

    const {type, notes} = dates[dateIndex];

    switch (type) {
      case 'class':
        return lessons[lessonIndex];

      case 'flex':
        return {notes};

      case 'holiday':
      case 'cancelled':
      default:
        return null;
    }
  };
};

export const matchDatesToLessons = ({students, teachers, dates}) => {
  const assignments = ['Opening Prayer', 'Spritual Thought', 'Closing Prayer'];

  const getNextDevotional = assignment(assignments, students);
  const getLesson = setupLessons(dates, dac);

  return dates.map(
    ({date, type, substitute, teacher_swap, lessonCount = 1, ...rest}, i) => {
      const devotional = typesWithNoClass.includes(type)
        ? null
        : getNextDevotional();

      const lessons = [];
      for (let index = 0; index < lessonCount; index++) {
        const lesson = getLesson(i);
        if (lesson) lessons.push(lesson);
      }

      // Move the current teacher to end of the array
      if (teacher_swap) teachers.push(teachers.shift());

      const teacher = substitute || getTeacher(date, type, teachers);

      return {date, type, teacher, devotional, lessons, ...rest};
    }
  );
};

export const setupInfoConfig = (transformedData, classList, fullSchedule) => {
  const countOfClassLessons = transformedData.dates
    .filter(({type}) => type === 'class')
    .reduce(
      (totalClassLessons, {lessonCount}) => totalClassLessons + lessonCount,
      0
    );

  const expectedClasses = classList.length;

  let errorMessages = [];

  if (countOfClassLessons > expectedClasses) {
    errorMessages.push(
      `You have ${countOfClassLessons} classes but there are only ${expectedClasses} this year. Consider changing class days in Airtable to flex days.`
    );
  } else if (countOfClassLessons < expectedClasses) {
    errorMessages.push(
      `You have ${countOfClassLessons} classes but there are ${expectedClasses} this year. Consider changing flex days in Airtable to class days or covering two classes on the same day.`
    );
  }

  const datesMissingType = transformedData.dates
    .filter(({type, date}) => !type && date)
    .map(({date}) => moment(date).format('M/D/YYYY'));

  if (datesMissingType.length > 0) {
    errorMessages.push(
      `The following dates are missing a corresponding type: ${datesMissingType.join(
        ', '
      )}. Update Airtable to reflect the correct type (i.e. class, flex, etc.) or delete the date.`
    );
  }

  const teacherConfig = fullSchedule
    .filter(({teacher}) => teacher)
    .reduce((teacherConfig, {teacher, type}) => {
      if (!teacherConfig[teacher]) {
        teacherConfig[teacher] = {lessonCount: 0};
      }
      teacherConfig[teacher].lessonCount++;
      return teacherConfig;
    }, {});

  return {
    countOfClassLessons,
    errorMessages,
    teacherConfig,
  };
};

const getLocalStorageName = baseName => `semimary_data_${baseName}`;

let schedule;
let infoConfig;

export default (baseName, callback) => {
  // Setup schedule from local
  const localData = JSON.parse(
    localStorage.getItem(getLocalStorageName(baseName)) || '{}'
  );

  if (localData.version === SCHEDULE_VERSION) {
    schedule = localData.schedule;
    infoConfig = localData.infoConfig;
    callback(localData.schedule, localData.infoConfig);
  }

  return getAllData(tables)
    .then(transformData)
    .then(transformedData => {
      const fullSchedule = matchDatesToLessons(transformedData);

      // Replace outer scope variables with updated data
      infoConfig = setupInfoConfig(transformedData, dac, fullSchedule);
      schedule = fullSchedule;

      // Store local version of the app
      localStorage.setItem(
        getLocalStorageName(baseName),
        JSON.stringify({
          version: SCHEDULE_VERSION,
          schedule: fullSchedule,
          infoConfig,
        })
      );

      // Return the updates to the app
      callback(fullSchedule, infoConfig);
    });
};

export const getSchedule = () => schedule;
export const getInfoConfig = () => infoConfig;

const sortBy = property => {
  return (a, b) => {
    if (a[property] > b[property]) {
      return 1;
    }
    if (a[property] < b[property]) {
      return -1;
    }
    return 0;
  };
};

const getDayName = date => {
  const today = moment().startOf('day');
  const diff = moment(date).diff(today, 'days');

  if (diff < 0) {
    return 'No classes found';
  } else if (diff === 0) {
    return 'Today';
  } else if (diff === 1) {
    return 'Tomorrow';
  } else {
    return `Next class in ${diff} days`;
  }
};

export const getNextClass = () => {
  const today = moment().startOf('day');
  const nextClass = schedule
    .sort(sortBy('date'))
    .find(({date}) => moment(date).diff(today, 'days') >= 0);

  if (!nextClass) {
    return {
      dayName: 'No classes found',
      finished: true,
    };
  }

  nextClass.dayName = getDayName(nextClass.date);
  return nextClass;
};
