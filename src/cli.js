
import arg from 'arg';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import { renameShow } from './MDBApi';

const parseArgumentsIntoOptions = (rawArgs) => {
  try {
    const args = arg({
      '--show': String,
      '-s': String,
      '--path': String,
      '-p': String,
    });

    return {
      path: args['--path'] || args['-p'],
      show: args['--show'] || args['-s'],
    };
  } catch (e) {
    return {};
  }
};

const promptForMissingOptions = async (options) => {
  const questions = [];
  if (options.path === undefined) {
    questions.push({
      type: 'input',
      name: 'path',
      message: 'Where are your files?',
      default: '.',
    });
  }
  if (options.show === undefined) {
    questions.push({
      type: 'input',
      name: 'show',
      message: 'What TV Show are you looking for?',
    });
  }

  const answers = await inquirer.prompt(questions);
  const newFilePath = options.path || answers.path;
  try {
    await fs.stat(newFilePath); // check if path exists
    return {
      ...options,
      path: newFilePath,
      show: options.show || answers.show ,
    };
  } catch (e) {
    // if path doesn't exist, use current directory
    return {
      ...options,
      path: '.',
    };
  }
};

export const cli = async (args) => {
  let options = parseArgumentsIntoOptions(args);
  options = await promptForMissingOptions(options);
  console.log(options);
  renameShow(options.show, options.path);
};
