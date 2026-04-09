AI额度不足导致的问题，但是输出内容似乎有问题？
实际上tasks里面是没有生成的

PS C:\WorkSpace\6_Source\2_VScode\99_gitProject\lumen> phasegate loop  
-> Selecting requirement: add-zzz-character-sunna
-> Running Phase 1...
OK Phase 1: Design Generation (with embedded self-check) complete.  [in: 3 / out: 133 tokens]
C:\WorkSpace\6_Source\2_VScode\99_gitProject\claudeCodeLeak\PhaseGate\dist\core\phase-transition-manager.js:250
            throw new Error('No module design files found in .phasegate/tasks/. Ensure the AI generated at least one task file before advancing.');
                  ^

Error: No module design files found in .phasegate/tasks/. Ensure the AI generated at least one task file before advancing.
    at PhaseTransitionManager.syncPhase1Outputs (C:\WorkSpace\6_Source\2_VScode\99_gitProject\claudeCodeLeak\PhaseGate\dist\core\phase-transition-manager.js:250:19)  
    at async PhaseTransitionManager.resolvePhase1 (C:\WorkSpace\6_Source\2_VScode\99_gitProject\claudeCodeLeak\PhaseGate\dist\core\phase-transition-manager.js:93:9)  
    at async runPhasesUntilDone (C:\WorkSpace\6_Source\2_VScode\99_gitProject\claudeCodeLeak\PhaseGate\dist\commands\run.js:219:28)
    at async Command.<anonymous> (C:\WorkSpace\6_Source\2_VScode\99_gitProject\claudeCodeLeak\PhaseGate\dist\commands\loop.js:156:28)

Node.js v22.17.1