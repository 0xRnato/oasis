#!/usr/bin/env node
const os = require("os");
const Ora = require("ora");
const CLI = require("clui");
const path = require('path');
const chalk = require("chalk");
const clear = require("clear");
const figlet = require("figlet");
const inquirer = require("inquirer");
const { fork } = require('child_process');

const Gauge = CLI.Gauge;
const title = chalk.keyword("darkgreen");
const question = chalk.keyword("white");
const response = chalk.keyword("green");
const error = chalk.keyword("red");
const log = chalk.keyword("gray").bold;
const uiText = chalk.keyword("darkgreen");
const uiResult = chalk.keyword("gray");

const ui = new inquirer.ui.BottomBar();
let spinner = new Ora({
  color: "green",
  text: log("Processing")
});

process.on("exit", code => {
  spinner.info(log(`About to exit with code: ${code}.`));
});

process.on("SIGINT", () => {
  spinner.info(log(`Finished by user.`));
  process.exit();
});

const getAnswers = () =>
  inquirer.prompt([
    {
      type: "input",
      name: "time",
      prefix: "",
      message: question(
        "Quandos segundos você deseja que este script fique rodando?"
      ),
      default: 60,
      validate: input => {
        if (input && !isNaN(input, 10)) {
          return true;
        } else {
          return error("Digite um valor inteiro.");
        }
      },
      transformer: (input, answers, flags) => {
        if (flags.isFinal) return response(input);
        return input;
      }
    },
    {
      type: "list",
      name: "action",
      prefix: "",
      message: question("Qual operação você deseja fazer?"),
      default: 0,
      choices: [
        {
          name:
            "Criar um array de buffer alocando a memória quando for preciso.",
          value: "scaling",
          short: response("Alocar quando for preciso.")
        },
        {
          name:
            "Alocar um espaço em memória para um array de buffer predefinido.",
          value: "allocate",
          short: response("Pré-alocado.")
        }
      ]
    },
    {
      type: "input",
      name: "bufferData",
      prefix: "",
      message: question("Qual dado salvar em cada posição do array?"),
      default: "A",
      validate: input => {
        if (input && input.length > 0) {
          return true;
        } else {
          return error("Digite um texto para ser salvo no array de buffer.");
        }
      },
      transformer: (input, answers, flags) => {
        if (flags.isFinal) return response(input);
        return input;
      }
    },
    {
      type: "input",
      name: "bufferCount",
      prefix: "",
      message: question("Quantas posições o array deve ter no total?"),
      default: 2000000000,
      validate: (input, answers) => {
        if (input && !isNaN(input, 10)) {
          if (
            input > 0 &&
            input * Buffer.from(answers.bufferData).length <= 2147483647
          ) {
            return true;
          } else {
            return error(
              `O máximo de posições disponíveis para o dado \'${
                answers.bufferData
              }\' é ${Buffer.from(answers.bufferData).length / 2147483647}.`
            );
          }
        } else {
          return error("Digite um valor numérico.");
        }
      },
      transformer: (input, answers, flags) => {
        if (flags.isFinal) return response(input);
        return input;
      }
    }
  ]);

const updateUI = () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const human = Math.ceil(used / 1000000) + " MB";
  const memoryLine = `${uiText("Memory In Use:")}  ${Gauge(
    used,
    total,
    20,
    total * 0.8,
    human
  )}`;

  const load = os.loadavg()[0];
  const maxLoad = os.cpus().length * 2;
  const danger = os.cpus().length;
  const loadLine = `${uiText("System Load:")}    ${Gauge(
    load,
    maxLoad,
    20,
    danger,
    load.toString()
  )}`;

  const uptimeLine = `${uiText("Process uptime:")} ${uiResult(
    Math.floor(process.uptime()) + " seconds"
  )}`;

  ui.updateBottomBar(`\n${memoryLine}\n${loadLine}\n${uptimeLine}\n`);
};

(async () => {
  try {
    clear();
    console.log(
      title(
        figlet.textSync("oasis", {
          horizontalLayout: "full",
          verticalLayout: "full"
        })
      )
    );
    ui.rl.output.mute();
    const answers = await getAnswers();
    updateUI();
    spinner.start();
    let result;
    let forked;
    if (answers.action === "scaling") {
      forked = fork(path.resolve(__dirname, '_scaling.js'));
    } else if (answers.action === "allocate") {
      forked = fork(path.resolve(__dirname, '_allocate.js'));
    }
    forked.on('message', (msg) => {
      if (msg.update) {
        updateUI();
        spinner.render();
      } else if (msg.result) {
        result = msg.result;
        spinner.stop();
        spinner = new Ora({
          text: log(
            "Finished and waiting for timeout. Type CTRL + C to stop now."
          ),
          spinner: { frames: ["✔"] },
          color: "green"
        });
        spinner.start();
        setInterval(() => {
          updateUI();
          spinner.render();
        }, 500);
        forked.kill();
      } else if (msg.err) {
        forked.kill();
        throw msg.err;
      }
    });
    forked.send({ bufferData: answers.bufferData, bufferCount: answers.bufferCount });
    setTimeout(() => {
      spinner.info(log("Finished by timeout"));
      forked.kill();
      process.exit();
    }, answers.time * 1000);
  } catch (err) {
    spinner.fail(err);
    process.exit(1);
  }
})();
