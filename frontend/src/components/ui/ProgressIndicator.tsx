/**
 * [INPUT]: 依赖 React 和 useRecreateStore
 * [OUTPUT]: 对外提供 ProgressIndicator 组件
 * [POS]: components UI组件，显示处理进度
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { motion } from 'framer-motion';
import { useRecreateStore, steps } from '../../store/recreateStore';

export function ProgressIndicator() {
  const { isProcessing, currentStep, progressMessage } = useRecreateStore();

  if (!isProcessing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto mt-6"
    >
      <div className="card glass">
        {/* 进度消息 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-light-gray mb-4">
            <div className="animate-spin-slow w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
          <h3 className="text-xl font-semibold text-dark mb-2">
            {progressMessage}
          </h3>
          <p className="text-sm text-mid-gray font-serif">
            预计需要30-60秒，请稍候...
          </p>
        </div>

        {/* 进度条 */}
        <div className="relative">
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-light-gray">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / 5) * 100}%` }}
              transition={{ duration: 0.5 }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-light justify-center bg-primary"
            />
          </div>

          {/* 步骤指示器 */}
          <div className="flex justify-between">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex flex-col items-center ${
                  index + 1 <= currentStep ? 'text-primary' : 'text-mid-gray'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index + 1 <= currentStep
                      ? 'bg-primary text-light'
                      : 'bg-light-gray text-mid-gray'
                  }`}
                >
                  {index + 1}
                </div>
                <span className="text-xs mt-2 hidden sm:block">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
