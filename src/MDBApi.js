import fs from 'fs/promises';
import inquirer from 'inquirer';
import fetch from 'node-fetch';

// config
const api_url = 'https://api.themoviedb.org/3';
const api_key = 'enter_yours_here';

const searchTvShow = async (showName) => {
  const url = new URL(api_url + '/search/tv');
  const params = {
    query: showName,
    api_key,
  };
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key]),
  );
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json();
  const shows = json.results;
  if (shows.length) {
    if (shows.length > 1) {
      const showIds = [];
      const showNamesYears = shows.map((show) => {
        showIds.push(show.id);
        return show.name + ' (' + show.first_air_date.split('-')[0] + ')';
      });
      const question = {
        type: 'list',
        name: 'show',
        message: 'Which show do you want to rename?',
        choices: showNamesYears,
      };
      const answers = await inquirer.prompt(question);
      const answerIndex = showNamesYears.indexOf(answers.show);
      return shows.find((show) => show.id === showIds[answerIndex]);
    } else return shows[0];
  } else
    throw new Error('Show could not be found..Please try a different name');
};

const getTvShowSeasons = async (showName) => {
  try {
    const show = await searchTvShow(showName);
    const url = new URL(api_url + '/tv/' + show.id);
    const params = {
      api_key,
    };
    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key]),
    );

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    const seasons = json.seasons;
    return seasons;
  } catch (e) {
    console.log(e.message);
  }
};

export const renameShow = async (showName, path) => {
  const tripleDigitsRegex = /.*(\d{3}).*/;
  let tripleDigitEpisodeFlag = false;
  try {
    const seasons = await getTvShowSeasons(showName);
    //set first episode attribute for each season based on previous season
    seasons.forEach((season, i) => {
      if (i === 0) {
        season.firstEpisode = 1;
      } else {
        season.firstEpisode =
          seasons[i - 1].firstEpisode + seasons[i - 1].episode_count;
      }
    });
    const episodeList = [];
    // ask user to enter video file extension
    const question = {
      type: 'list',
      name: 'extension',
      message: 'What is the video file format?',
      choices: ['MKV', 'MP4', 'AVI', 'Other'],
    };
    const answers = await inquirer.prompt(question);
    let extension = answers.extension;
    if (extension === 'Other') {
      const question = {
        type: 'input',
        name: 'extension',
        message: 'What is the video file format?',
      };
      const answers = await inquirer.prompt(question);
      extension = answers.extension;
    }
    extension = extension.toLowerCase();
    // append all files with extension to episodeList using fs
    const files = await fs.readdir(path);
    files.forEach((file) => {
      if (file.endsWith(extension)) {
        // match first regex group
        const match = file.match(tripleDigitsRegex)[1];
        //check if episode format has 3 digits in a row 001 - 999
        if (!tripleDigitEpisodeFlag && match) {
          tripleDigitEpisodeFlag = true;
        }
        if (match) {
          episodeList.push({
            file,
            tripleDigitMatch: match,
            episodeNum: Number(match),
          });
        }
      }
    });
    // sum all episode count from seasons
    let episodeCount = 0;
    seasons.forEach((season) => {
      episodeCount += season.episode_count;
    });
    // if episode format has 3 digits in a row 001 - 999 rename files
    if (tripleDigitEpisodeFlag) {
      const newEpisodeList = [];
      // set season number to episode number
      episodeList.forEach((episode) => {
        seasons.forEach((season, i) => {
          if (
            episode.tripleDigitMatch >= season.firstEpisode &&
            episode.tripleDigitMatch <=
              season.firstEpisode + season.episode_count - 1
          ) {
            episode.season = i + 1;
            newEpisodeList.push(episode);
          }
        });
      });
      //create season folders if they dont exist using season name using fs promises
      seasons.forEach(async (season) => {
        const seasonPath = path + '/' + season.name;
        //use stats to check if directory exists
        const stats = await fs.stat(seasonPath);
        if (!stats.isDirectory()) {
          await fs.mkdir(seasonPath);
        }
      });

      const newEpisodePaths = [];
      newEpisodeList.forEach(async (episode) => {
        const seasonPath = path + '/' + seasons[episode.season - 1].name;
        let calculatedEpisodeNumber = Number(
          episode.episodeNum - seasons[episode.season - 1].firstEpisode + 1,
        );
        calculatedEpisodeNumber = String(
          calculatedEpisodeNumber > 9
            ? calculatedEpisodeNumber
            : '0' + calculatedEpisodeNumber,
        );
        const calculatedSeasonNumber = String(
          episode.season > 9 ? episode.season : '0' + episode.season,
        );
        const newFileName =
          seasonPath +
          '/' +
          showName +
          ' S' +
          calculatedSeasonNumber +
          'E' +
          calculatedEpisodeNumber +
          '.' +
          extension;
        newEpisodePaths.push(newFileName);
      });
      const originalPaths = episodeList.map((episode) => {
        return path + '/' + episode.file;
      });
      const paths = [];
      //rename files using fs promises
      originalPaths.forEach((path, i) => {
        console.log(path, ' ---> ', newEpisodePaths[i]);
        paths.push({ original: path, new: newEpisodePaths[i] });
      });
      // ask user if he wants to proceed
      const question = {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to rename the files?',
        default: false,
      };
      const answers = await inquirer.prompt(question);
      if (answers.confirm) {
        paths.forEach(async (path) => {
          await fs.rename(path.original, path.new);
          console.log('Renamed ' + path.original + ' to ' + path.new);
        });
      }
    }
  } catch (e) {
    console.log(e.message);
  }
};
